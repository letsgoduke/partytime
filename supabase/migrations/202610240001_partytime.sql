-- All monetary values are integer cents. Guest access is capability based; raw tokens never persist.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
revoke create on schema public from public,anon,authenticated;
create table public.profiles (id uuid primary key references auth.users on delete cascade, display_name text not null default 'Party friend', created_at timestamptz not null default now());
create table public.parties (
 id uuid primary key default gen_random_uuid(), host_id uuid not null references public.profiles,
 title text not null check(length(title) between 1 and 120), cover_url text check(cover_url is null or (length(cover_url)<=2048 and cover_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?(/[^[:space:]]*)?$')), description text not null default '',
 starts_at timestamptz not null, ends_at timestamptz, general_location text not null default '', address text not null default '',
 address_visibility text not null default 'guests' check(address_visibility in ('guests','host')),
 budget_cents integer not null default 0 check(budget_cents between 0 and 100000000), capacity integer check(capacity > 0),
 status text not null default 'published' check(status in ('draft','published','canceled','finalized','archived')),
 rsvps_open boolean not null default true, cancellation_deadline timestamptz, created_at timestamptz not null default now(), finalized_at timestamptz,
 check(ends_at is null or ends_at >= starts_at));
create table public.party_invites (id uuid primary key default gen_random_uuid(), party_id uuid not null references public.parties on delete cascade, token_hash text unique not null, revoked_at timestamptz, created_at timestamptz not null default now());
create table public.guests (id uuid primary key default gen_random_uuid(), party_id uuid not null references public.parties on delete cascade, profile_id uuid references public.profiles, display_name text not null check(length(display_name) between 1 and 80), rsvp text not null check(rsvp in ('going','maybe','declined')), attendance_attested boolean not null default false, created_at timestamptz not null default now(), unique(party_id,profile_id));
create table public.guest_access_tokens (id uuid primary key default gen_random_uuid(), guest_id uuid not null references public.guests on delete cascade, token_hash text unique not null, revoked_at timestamptz, created_at timestamptz not null default now());
create table public.needs (id uuid primary key default gen_random_uuid(), party_id uuid not null references public.parties on delete cascade, kind text not null check(kind in ('item','task','expense')), title text not null check(length(title) between 1 and 160), quantity integer not null default 1 check(quantity between 1 and 10000), allow_partial boolean not null default true, estimated_value_cents integer not null default 0 check(estimated_value_cents between 0 and 1000000), minutes_per_unit integer not null default 0 check(minutes_per_unit between 0 and 1440));
create table public.claims (id uuid primary key default gen_random_uuid(), guest_id uuid not null references public.guests, need_id uuid not null references public.needs, quantity integer not null check(quantity > 0), status text not null default 'claimed' check(status in ('claimed','delivered','completed','released','not_fulfilled')), created_at timestamptz not null default now());
create table public.pledges (id uuid primary key default gen_random_uuid(), guest_id uuid not null references public.guests, party_id uuid not null references public.parties, amount_cents integer not null check(amount_cents between 1 and 100000000), status text not null default 'pledged' check(status in ('pledged','payment_initiated','confirmed','canceled','disputed')), anonymous boolean not null default false, sponsorship boolean not null default false, created_at timestamptz not null default now());
create table public.payment_methods (id uuid primary key default gen_random_uuid(), party_id uuid not null references public.parties on delete cascade, label text not null, url text not null check(url ~ '^https://[^[:space:]]+$'));
create table public.attendance_records (guest_id uuid primary key references public.guests, attended boolean not null, verified_by uuid not null references public.profiles, verified_at timestamptz not null default now());
create table public.fulfillment_records (id uuid primary key default gen_random_uuid(), claim_id uuid unique references public.claims, pledge_id uuid unique references public.pledges, verified_by uuid not null references public.profiles, verified_at timestamptz not null default now(), check(num_nonnulls(claim_id,pledge_id)=1));
create table public.party_updates (id uuid primary key default gen_random_uuid(), party_id uuid not null references public.parties, message text not null check(length(message) between 1 and 2000), created_at timestamptz not null default now());
create table public.score_events (id uuid primary key default gen_random_uuid(), party_id uuid not null references public.parties, guest_id uuid references public.guests, profile_id uuid references public.profiles, category text not null check(category in ('reputation','prestige','aura')), activity_key text unique not null, value numeric not null, weight numeric not null default 1, reverses_id uuid unique references public.score_events, created_at timestamptz not null default now(), check(guest_id is not null or profile_id is not null));
create table public.score_summaries (profile_id uuid primary key references public.profiles, reputation numeric, prestige numeric not null default 0, aura numeric not null default 0, verified_activities integer not null default 0, updated_at timestamptz not null default now());
create table public.score_disputes (id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles, score_event_id uuid not null references public.score_events, reason text not null check(length(reason) between 10 and 2000), status text not null default 'open' check(status in ('open','resolved','rejected')), created_at timestamptz not null default now());
create table public.achievements (id text primary key, title text not null, description text not null);
create table public.user_achievements (profile_id uuid references public.profiles, achievement_id text references public.achievements, earned_at timestamptz not null default now(), primary key(profile_id,achievement_id));
create table public.audit_events (id uuid primary key default gen_random_uuid(), party_id uuid references public.parties, actor_id uuid, action text not null, details jsonb not null default '{}', created_at timestamptz not null default now());
create table public.api_requests (scope text not null, request_key uuid not null, action text not null, request_hash text not null, response bytea not null, created_at timestamptz not null default now(), primary key(scope,request_key));
create table public.internal_secrets (id boolean primary key default true check(id), value text not null);
insert into public.internal_secrets(value) values(encode(extensions.gen_random_bytes(32),'hex'));
create table public.api_rate_limits (scope text primary key, window_start timestamptz not null default now(), requests integer not null default 0);
create table public.scoring_rules (id boolean primary key default true check(id), money_rate numeric not null default 1, supplies_rate numeric not null default 1, hourly_rate numeric not null default 15, aura_attendance numeric not null default 10, aura_money numeric not null default 2, aura_supplies numeric not null default 3, minimum_participants integer not null default 2, max_prestige_per_activity integer not null default 1000, max_aura_per_party integer not null default 500, reputation_half_life_days numeric not null default 180);
insert into public.scoring_rules(id) values(true);
insert into public.achievements values ('first-host','First Party Hosted','Finalize your first verified gathering.'),('helper','Dependable Helper','Complete five verified commitments.'),('ten-attended','Ten Parties Attended','Attend ten verified gatherings.');
create index on public.parties(host_id);
create index on public.party_invites(party_id);
create index on public.guest_access_tokens(guest_id);
create index on public.guests(profile_id);
create index on public.claims(guest_id);
create index on public.pledges(guest_id);
create index on public.party_updates(party_id,created_at);
create index on public.guests(party_id);
create index on public.needs(party_id);
create index on public.claims(need_id,status);
create index on public.pledges(party_id,status);
create index on public.score_events(guest_id);
create index on public.score_events(profile_id);
create index on public.audit_events(party_id);

-- No direct client mutations. Sensitive reads and all writes use the narrow RPC below.
do $$ declare t text; begin
 foreach t in array array['profiles','parties','party_invites','guests','guest_access_tokens','needs','claims','pledges','payment_methods','attendance_records','fulfillment_records','party_updates','score_events','score_summaries','score_disputes','achievements','user_achievements','audit_events','api_requests','api_rate_limits','scoring_rules','internal_secrets'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.profiles, public.score_summaries, public.achievements, public.user_achievements to authenticated;
create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
create policy own_scores on public.score_summaries for select to authenticated using(profile_id=auth.uid());
create policy achievements_read on public.achievements for select to authenticated using(true);
create policy own_achievements on public.user_achievements for select to authenticated using(profile_id=auth.uid());

create function public.immutable_ledger() returns trigger language plpgsql set search_path=public as $$ begin raise exception 'Score history is immutable; append a reversal'; end $$;
create trigger immutable_scores before update or delete on public.score_events for each row execute function public.immutable_ledger();

-- Aggregate with one row per ledger entry; avoid multiplying host awards by the host's guest rows.
create function public.refresh_scores() returns void language sql security definer set search_path=public,extensions as $$
 with resolved as(select e.*,coalesce(e.profile_id,g.profile_id) as owner_id from score_events e left join guests g on g.id=e.guest_id),
 active as(select e.*,power(0.5,extract(epoch from(now()-e.created_at))/86400/(select reputation_half_life_days from scoring_rules)) as decay from resolved e join parties source_party on source_party.id=e.party_id where (e.guest_id is null or e.owner_id is distinct from source_party.host_id) and e.reverses_id is null and not exists(select 1 from score_events r where r.reverses_id=e.id)),
 sums as(select p.id,count(a.id) filter(where a.category='reputation') as n,
 coalesce(sum(a.value*a.weight*a.decay) filter(where a.category='reputation'),0) as fulfilled,
 coalesce(sum(a.weight*a.decay) filter(where a.category='reputation'),0) as total,
 coalesce(sum(a.value) filter(where a.category='prestige'),0) as prestige,coalesce(sum(a.value) filter(where a.category='aura'),0) as aura
 from profiles p left join active a on a.owner_id=p.id group by p.id)
 insert into score_summaries(profile_id,reputation,prestige,aura,verified_activities,updated_at)
 select id,case when n>=5 then round(100*(2+fulfilled)/(4+total),1) end,greatest(0,prestige),greatest(0,aura),n,now() from sums
 on conflict(profile_id) do update set reputation=excluded.reputation,prestige=excluded.prestige,aura=excluded.aura,verified_activities=excluded.verified_activities,updated_at=now();
$$;

create function public.party_snapshot(p_id uuid, p_private boolean default false, p_host boolean default false) returns jsonb language sql security definer set search_path=public,extensions as $$
 select jsonb_build_object('id',p.id,'title',p.title,'coverUrl',p.cover_url,'description',p.description,'startsAt',p.starts_at,'endsAt',p.ends_at,'generalLocation',p.general_location,
 'address',case when p_private and(p.address_visibility='guests' or p_host) then p.address else null end,'hostName',pr.display_name,'hostId',p.host_id,
 'budgetCents',p.budget_cents,'capacity',p.capacity,'status',p.status,'rsvpsOpen',p.rsvps_open,
 'date',to_char(p.starts_at at time zone 'UTC','YYYY-MM-DD'),'time',to_char(p.starts_at at time zone 'UTC','HH24:MI'),'location',p.general_location,'guests','[]'::jsonb,'claims','[]'::jsonb,'pledges','[]'::jsonb,
 'maybe',(select count(*) from guests g where g.party_id=p.id and rsvp='maybe'),'declined',(select count(*) from guests g where g.party_id=p.id and rsvp='declined'),
 'going',(select count(*) from guests g where g.party_id=p.id and rsvp='going'),
 'confirmedCents',(select coalesce(sum(amount_cents),0) from pledges where party_id=p.id and status='confirmed'),
 'paymentUrl',(select m.url from payment_methods m where m.party_id=p.id order by m.id limit 1),
 'pendingCents',(select coalesce(sum(amount_cents),0) from pledges where party_id=p.id and status in ('pledged','payment_initiated')),
 'needs',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'kind',n.kind,'title',n.title,'quantity',n.quantity,'allowPartial',n.allow_partial,'estimatedValueCents',n.estimated_value_cents,'minutesPerUnit',n.minutes_per_unit,'note','', 'valueCents',n.estimated_value_cents,'claimed',(select coalesce(sum(c.quantity),0) from claims c where c.need_id=n.id and c.status in ('claimed','delivered','completed')),'claimedQuantity',(select coalesce(sum(c.quantity),0) from claims c where c.need_id=n.id and c.status in ('claimed','delivered','completed')))),'[]') from needs n where n.party_id=p.id),
 'paymentMethods',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'label',m.label,'url',m.url)),'[]') from payment_methods m where m.party_id=p.id),
 'updates',(select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'message',u.message,'createdAt',u.created_at) order by u.created_at desc),'[]') from party_updates u where u.party_id=p.id))
 from parties p join profiles pr on pr.id=p.host_id where p.id=p_id;
$$;
create function public.party_api(action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare
 v_party parties%rowtype; v_guest guests%rowtype; v_need needs%rowtype; v_claim claims%rowtype; v_pledge pledges%rowtype;
 v_result jsonb; v_token text; v_invite text; v_scope text; v_key uuid; v_used integer; v_amount integer; v_quantity integer;
 v_uid uuid:=auth.uid(); v_id uuid; v_attendees integer; v_funding numeric; v_supplies numeric; v_aura numeric; v_rules scoring_rules%rowtype; v_n jsonb; v_existing_action text; v_existing_hash text;
begin
 if action not in ('invitation','rsvp','guest','claim','pledge','releaseClaim','cancelPledge','editPledge','changeRsvp','confirmAttendance','linkGuest','createParty','dashboard','listParties','confirmPayment','verifyClaim','attendance','finalize','rotateInvite','updateParty','postUpdate','profile','dispute','revokeGuest') then raise exception 'Unknown action' using errcode='22023'; end if;
 -- Rate limit per verified capability (plus a global anonymous bound). No IP trust in client payloads.
 v_scope:=case when v_uid is not null then v_uid::text else encode(digest(coalesce(payload->>'managementToken',payload->>'inviteToken','anonymous'),'sha256'),'hex') end;
 insert into api_rate_limits(scope,window_start,requests) values(v_scope,now(),1)
 on conflict(scope) do update set requests=case when api_rate_limits.window_start < now()-interval '1 minute' then 1 else api_rate_limits.requests+1 end,window_start=case when api_rate_limits.window_start < now()-interval '1 minute' then now() else api_rate_limits.window_start end returning requests into v_used;
 if v_used>120 then raise exception 'Too many requests; try again in a minute' using errcode='54000'; end if;
 if action in ('guest','claim','pledge','releaseClaim','cancelPledge','editPledge','changeRsvp','confirmAttendance','linkGuest') then
 select g.* into v_guest from guests g join guest_access_tokens t on t.guest_id=g.id where t.token_hash=encode(digest(coalesce(payload->>'managementToken',''),'sha256'),'hex') and t.revoked_at is null;
 if not found then raise exception 'Invalid or revoked guest access' using errcode='42501'; end if;
 select * into v_party from parties where id=v_guest.party_id for update;
 elsif action in ('invitation','rsvp') then
 select p.* into v_party from parties p join party_invites i on i.party_id=p.id where i.token_hash=encode(digest(coalesce(payload->>'inviteToken',''),'sha256'),'hex') and i.revoked_at is null and p.status in ('published','finalized');
 if not found then raise exception 'Invitation unavailable' using errcode='42501'; end if;
 -- Lock the party, serializing RSVP capacity and funding-gap snapshots.
 select * into v_party from parties where id=v_party.id for update;
 else
 if v_uid is null then raise exception 'Sign in required' using errcode='42501'; end if;
 insert into profiles(id,display_name) values(v_uid,left(coalesce(nullif(payload->>'hostName',''),'Party friend'),80)) on conflict do nothing;
 if action not in ('createParty','listParties','profile','dispute') then
 if action='confirmPayment' then select * into v_pledge from pledges where id=(payload->>'pledgeId')::uuid; v_id:=v_pledge.party_id;
 elsif action='verifyClaim' then select * into v_claim from claims where id=(payload->>'claimId')::uuid; select party_id into v_id from needs where id=v_claim.need_id;
 elsif action in ('attendance','revokeGuest') then select * into v_guest from guests where id=(payload->>'guestId')::uuid; v_id:=v_guest.party_id;
 else v_id:=(payload->>'partyId')::uuid; end if;
 select * into v_party from parties where id=v_id and host_id=v_uid for update;
 if not found then raise exception 'Party access denied' using errcode='42501'; end if;
 end if;
 end if;
 -- Mutations must carry a UUID idempotency key. Advisory lock covers retries before the stored result exists.
 if action not in ('invitation','guest','dashboard','listParties','profile') then
 v_key:=(payload->>'idempotencyKey')::uuid;
 if v_key is null then raise exception 'idempotencyKey is required' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_scope||v_key::text,0));
 select pgp_sym_decrypt(response,(select value from internal_secrets))::jsonb,api_requests.action,request_hash into v_result,v_existing_action,v_existing_hash from api_requests where scope=v_scope and request_key=v_key;
 if found then
 if v_existing_action<>action or v_existing_hash<>encode(digest(payload::text,'sha256'),'hex') then raise exception 'Idempotency key reused for a different request'; end if;
 return v_result; end if;
 end if;
 if action='invitation' then return party_snapshot(v_party.id);
 elsif action='guest' then
 return jsonb_build_object('party',party_snapshot(v_party.id,true),'guest',jsonb_build_object('id',v_guest.id,'name',v_guest.display_name,'status',v_guest.rsvp,'profileId',v_guest.profile_id),
 'claims',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'needId',c.need_id,'quantity',c.quantity,'status',c.status)),'[]') from claims c where guest_id=v_guest.id),
 'pledges',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'amountCents',p.amount_cents,'status',p.status,'anonymous',p.anonymous)),'[]') from pledges p where guest_id=v_guest.id));
 elsif action='rsvp' then
 if not v_party.rsvps_open or v_party.status<>'published' then raise exception 'RSVPs are closed'; end if;
 if payload->>'status'='going' and v_party.capacity is not null and(select count(*) from guests where party_id=v_party.id and rsvp='going')>=v_party.capacity then raise exception 'This party is at capacity'; end if;
 insert into guests(party_id,display_name,rsvp) values(v_party.id,btrim(payload->>'name'),payload->>'status') returning * into v_guest;
 v_token:=encode(gen_random_bytes(32),'hex');
 insert into guest_access_tokens(guest_id,token_hash) values(v_guest.id,encode(digest(v_token,'sha256'),'hex'));
 v_result:=jsonb_build_object('guest',jsonb_build_object('id',v_guest.id,'name',v_guest.display_name,'status',v_guest.rsvp),'managementToken',v_token,'party',party_snapshot(v_party.id,true));
 elsif action='claim' then
 if v_party.status<>'published' then raise exception 'Contributions are closed'; end if;
 select * into v_need from needs where id=(payload->>'needId')::uuid and party_id=v_guest.party_id and kind in ('item','task') for update;
 if not found then raise exception 'Need unavailable'; end if;
 v_quantity:=(payload->>'quantity')::integer;
 if v_quantity is null or v_quantity<1 or(not v_need.allow_partial and v_quantity<>v_need.quantity) then raise exception 'Invalid quantity'; end if;
 select coalesce(sum(quantity),0) into v_used from claims where need_id=v_need.id and status in ('claimed','delivered','completed');
 if v_used+v_quantity>v_need.quantity then raise exception 'That quantity is no longer available'; end if;
 insert into claims(guest_id,need_id,quantity) values(v_guest.id,v_need.id,v_quantity) returning * into v_claim;
 v_result:=jsonb_build_object('id',v_claim.id,'needId',v_claim.need_id,'quantity',v_claim.quantity,'status',v_claim.status);
 elsif action='pledge' then
 if v_party.status<>'published' then raise exception 'Contributions are closed'; end if;
 if coalesce((payload->>'coverRemaining')::boolean,false) then
 select greatest(0,v_party.budget_cents-coalesce(sum(amount_cents) filter(where status='confirmed'),0)) into v_amount from pledges where party_id=v_party.id;
 else v_amount:=(payload->>'amountCents')::integer; end if;
 if v_amount is null or v_amount<1 then raise exception 'Amount must be at least one cent'; end if;
 insert into pledges(guest_id,party_id,amount_cents,anonymous,sponsorship) values(v_guest.id,v_party.id,v_amount,coalesce((payload->>'anonymous')::boolean,false),coalesce((payload->>'sponsorship')::boolean,false) or coalesce((payload->>'coverRemaining')::boolean,false)) returning * into v_pledge;
 v_result:=jsonb_build_object('id',v_pledge.id,'amountCents',v_amount,'status',v_pledge.status);
 elsif action='editPledge' then
 if v_party.status<>'published' then raise exception 'Contributions are closed'; end if;
 v_amount:=(payload->>'amountCents')::integer;
 if v_amount is null or v_amount<1 then raise exception 'Amount must be at least one cent'; end if;
 update pledges set amount_cents=v_amount where id=(payload->>'pledgeId')::uuid and guest_id=v_guest.id and status in ('pledged','payment_initiated');
 if not found then raise exception 'Pending pledge not found'; end if;
 v_result:=jsonb_build_object('ok',true,'amountCents',v_amount);
 elsif action in ('releaseClaim','cancelPledge') then
 if v_party.status<>'published' then raise exception 'This party is closed'; end if;
 if action='releaseClaim' then update claims set status='released' where id=(payload->>'claimId')::uuid and guest_id=v_guest.id and status='claimed';
 else update pledges set status='canceled' where id=(payload->>'pledgeId')::uuid and guest_id=v_guest.id and status in ('pledged','payment_initiated'); end if;
 if not found then raise exception 'Pending contribution not found'; end if;
 v_result:='{"ok":true}';
 elsif action='changeRsvp' then
 if v_party.status<>'published' or not v_party.rsvps_open then raise exception 'RSVPs are closed'; end if;
 if payload->>'status'='going' and v_guest.rsvp<>'going' and v_party.capacity is not null and(select count(*) from guests where party_id=v_party.id and rsvp='going')>=v_party.capacity then raise exception 'This party is at capacity'; end if;
 if payload ? 'name' and length(btrim(payload->>'name')) not between 1 and 80 then raise exception 'Guest name must be 1–80 characters'; end if;
 update guests set rsvp=coalesce(payload->>'status',rsvp),display_name=coalesce(btrim(payload->>'name'),display_name) where id=v_guest.id;
 v_result:='{"ok":true}';
 elsif action='confirmAttendance' then
 if v_party.starts_at>now() or v_party.status='canceled' then raise exception 'Attendance can only be attested after the event starts'; end if;
 update guests set attendance_attested=true where id=v_guest.id;
 v_result:='{"ok":true}';
 elsif action='linkGuest' then
 if v_uid is null then raise exception 'Sign in required'; end if;
 insert into profiles(id) values(v_uid) on conflict do nothing;
 if v_guest.profile_id is not null and v_guest.profile_id<>v_uid then raise exception 'Guest is already linked'; end if;
 update guests set profile_id=v_uid where id=v_guest.id;
 update profiles set display_name=v_guest.display_name where id=v_uid and display_name='Party friend';
 perform refresh_scores(); v_result:='{"ok":true}';
 elsif action='createParty' then
 if payload ? 'hostName' then
 if length(btrim(payload->>'hostName')) not between 1 and 80 then raise exception 'Host name must be 1–80 characters'; end if;
 update profiles set display_name=btrim(payload->>'hostName') where id=v_uid; end if;
 insert into parties(host_id,title,cover_url,description,starts_at,ends_at,general_location,address,budget_cents,capacity,cancellation_deadline)
 values(v_uid,payload->>'title',nullif(payload->>'coverUrl',''),coalesce(payload->>'description',''),(payload->>'startsAt')::timestamptz,(payload->>'endsAt')::timestamptz,coalesce(payload->>'generalLocation',''),coalesce(payload->>'address',''),coalesce((payload->>'budgetCents')::integer,0),(payload->>'capacity')::integer,(payload->>'cancellationDeadline')::timestamptz) returning * into v_party;
 for v_n in select value from jsonb_array_elements(coalesce(payload->'needs','[]')) loop
 insert into needs(party_id,kind,title,quantity,allow_partial,estimated_value_cents,minutes_per_unit) values(v_party.id,v_n->>'kind',v_n->>'title',coalesce((v_n->>'quantity')::integer,1),coalesce((v_n->>'allowPartial')::boolean,true),coalesce((v_n->>'estimatedValueCents')::integer,0),coalesce((v_n->>'minutesPerUnit')::integer,0)); end loop;
 for v_n in select value from jsonb_array_elements(coalesce(payload->'paymentMethods','[]')) loop
 insert into payment_methods(party_id,label,url) values(v_party.id,v_n->>'label',v_n->>'url'); end loop;
 v_invite:=encode(gen_random_bytes(32),'hex');
 insert into party_invites(party_id,token_hash) values(v_party.id,encode(digest(v_invite,'sha256'),'hex'));
 v_result:=jsonb_build_object('party',party_snapshot(v_party.id,true,true),'inviteToken',v_invite);
 elsif action='listParties' then
 return jsonb_build_object('parties',(select coalesce(jsonb_agg(party_snapshot(id,true,true) order by starts_at desc),'[]') from parties where host_id=v_uid));
 elsif action='dashboard' then
 return jsonb_build_object('party',party_snapshot(v_party.id,true,true),
 'guests',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.display_name,'status',g.rsvp,'attended',a.attended,'attendanceAttested',g.attendance_attested)),'[]') from guests g left join attendance_records a on a.guest_id=g.id where g.party_id=v_party.id),
 'claims',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'guestId',c.guest_id,'needId',c.need_id,'quantity',c.quantity,'status',c.status)),'[]') from claims c join guests g on g.id=c.guest_id where g.party_id=v_party.id),
 'pledges',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'guestId',p.guest_id,'name',(select display_name from guests where id=p.guest_id),'amountCents',p.amount_cents,'status',p.status)),'[]') from pledges p where p.party_id=v_party.id));
 elsif action in ('confirmPayment','verifyClaim','attendance') then
 if v_party.status in ('finalized','canceled','archived') then raise exception 'Finalized or canceled party cannot be changed'; end if;
 if action='confirmPayment' then
 update pledges set status='confirmed' where id=v_pledge.id and status in ('pledged','payment_initiated');
 if not found then raise exception 'Payment is not pending'; end if;
 insert into fulfillment_records(pledge_id,verified_by) values(v_pledge.id,v_uid) on conflict(pledge_id) do nothing;
 elsif action='verifyClaim' then
 select * into v_need from needs where id=v_claim.need_id;
 update claims set status=case when coalesce((payload->>'fulfilled')::boolean,true) then case when v_need.kind='task' then 'completed' else 'delivered' end else 'not_fulfilled' end where id=v_claim.id and status='claimed';
 if not found then raise exception 'Claim is not pending'; end if;
 insert into fulfillment_records(claim_id,verified_by) values(v_claim.id,v_uid) on conflict(claim_id) do nothing;
 else
 if v_party.starts_at>now() then raise exception 'Event has not started'; end if;
 insert into attendance_records(guest_id,attended,verified_by) values(v_guest.id,(payload->>'attended')::boolean,v_uid) on conflict(guest_id) do update set attended=excluded.attended,verified_at=now(); end if;
 v_result:='{"ok":true}';
 elsif action='rotateInvite' then
 update party_invites set revoked_at=now() where party_id=v_party.id and revoked_at is null;
 v_invite:=encode(gen_random_bytes(32),'hex'); insert into party_invites(party_id,token_hash) values(v_party.id,encode(digest(v_invite,'sha256'),'hex'));
 v_result:=jsonb_build_object('inviteToken',v_invite);
 elsif action='updateParty' then
 if v_party.status='finalized' then raise exception 'Finalized party is immutable'; end if;
 if payload ? 'status' and payload->>'status' not in ('published','canceled','archived') then raise exception 'Invalid status'; end if;
 update parties set title=coalesce(payload->>'title',title),cover_url=case when payload ? 'coverUrl' then nullif(payload->>'coverUrl','') else cover_url end,ends_at=case when payload ? 'endsAt' then (payload->>'endsAt')::timestamptz else ends_at end,description=coalesce(payload->>'description',description),address=coalesce(payload->>'address',address),general_location=coalesce(payload->>'generalLocation',general_location),budget_cents=coalesce((payload->>'budgetCents')::integer,budget_cents),rsvps_open=coalesce((payload->>'rsvpsOpen')::boolean,rsvps_open),status=coalesce(payload->>'status',status),address_visibility=coalesce(payload->>'addressVisibility',address_visibility) where id=v_party.id;
 v_result:=jsonb_build_object('party',party_snapshot(v_party.id,true,true));
 elsif action='revokeGuest' then
 update guest_access_tokens set revoked_at=now() where guest_id=v_guest.id and revoked_at is null; v_result:='{"ok":true}';
 elsif action='postUpdate' then
 insert into party_updates(party_id,message) values(v_party.id,payload->>'message'); v_result:='{"ok":true}';
 elsif action='profile' then
 perform refresh_scores();
 return jsonb_build_object('profile',(select jsonb_build_object('id',id,'name',display_name) from profiles where id=v_uid),'scores',(select jsonb_build_object('reputation',reputation,'prestige',prestige,'aura',aura,'verifiedActivities',verified_activities) from score_summaries where profile_id=v_uid),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]') from score_events e left join guests g on g.id=e.guest_id where coalesce(e.profile_id,g.profile_id)=v_uid));
 elsif action='dispute' then
 if not exists(select 1 from score_events e left join guests g on g.id=e.guest_id where e.id=(payload->>'scoreEventId')::uuid and coalesce(e.profile_id,g.profile_id)=v_uid) then raise exception 'Score access denied'; end if;
 insert into score_disputes(profile_id,score_event_id,reason) values(v_uid,(payload->>'scoreEventId')::uuid,payload->>'reason'); v_result:='{"ok":true}';
 elsif action='finalize' then
 if v_party.status<>'published' or coalesce(v_party.ends_at,v_party.starts_at+interval '2 hours')>now() then raise exception 'Only an occurred, published party can be finalized'; end if;
 select * into v_rules from scoring_rules where id=true;
 -- Pending/unreviewed activities remain neutral. Explicit verified failure is required for negative evidence.
 insert into score_events(party_id,guest_id,category,activity_key,value,weight)
 select v_party.id,g.id,'reputation','attendance:'||g.id,case when a.attended then 1 else 0 end,1 from guests g join attendance_records a on a.guest_id=g.id where g.party_id=v_party.id and g.rsvp='going' and g.profile_id is distinct from v_party.host_id on conflict(activity_key) do nothing;
 insert into score_events(party_id,guest_id,category,activity_key,value,weight)
 select v_party.id,c.guest_id,'reputation','claim:'||c.id,case when c.status in ('delivered','completed') then 1 else 0 end,1 from claims c join guests g on g.id=c.guest_id where g.party_id=v_party.id and c.status in ('delivered','completed','not_fulfilled') and g.profile_id is distinct from v_party.host_id on conflict(activity_key) do nothing;
 insert into score_events(party_id,guest_id,category,activity_key,value,weight)
 select v_party.id,p.guest_id,'reputation','pledge:'||p.id,1,1 from pledges p join guests g on g.id=p.guest_id where p.party_id=v_party.id and p.status='confirmed' and g.profile_id is distinct from v_party.host_id on conflict(activity_key) do nothing;
 -- Anonymous verified activity stays on the ledger; it becomes a persistent score only after proof-based account linking.
 insert into score_events(party_id,guest_id,category,activity_key,value)
 select v_party.id,p.guest_id,'prestige','money:'||p.id,least(v_rules.max_prestige_per_activity,p.amount_cents/100.0*v_rules.money_rate) from pledges p join guests g on g.id=p.guest_id where p.party_id=v_party.id and p.status='confirmed' and g.profile_id is distinct from v_party.host_id on conflict(activity_key) do nothing;
 insert into score_events(party_id,guest_id,category,activity_key,value)
 select v_party.id,c.guest_id,'prestige','supply:'||c.id,least(v_rules.max_prestige_per_activity,case when n.kind='task' then n.minutes_per_unit*c.quantity/60.0*v_rules.hourly_rate else n.estimated_value_cents*c.quantity/100.0*v_rules.supplies_rate end)
 from claims c join needs n on n.id=c.need_id join guests g on g.id=c.guest_id where n.party_id=v_party.id and c.status in ('delivered','completed') and g.profile_id is distinct from v_party.host_id on conflict(activity_key) do nothing;
 select count(distinct g.profile_id) into v_attendees from guests g join attendance_records a on a.guest_id=g.id where g.party_id=v_party.id and a.attended and g.attendance_attested and g.profile_id<>v_party.host_id;
 if v_attendees>=v_rules.minimum_participants then
 select coalesce(sum(p.amount_cents),0)/100.0 into v_funding from pledges p join guests g on g.id=p.guest_id where p.party_id=v_party.id and p.status='confirmed' and g.profile_id is not null and g.profile_id<>v_party.host_id;
 select coalesce(sum(n.estimated_value_cents*c.quantity),0)/100.0 into v_supplies from claims c join needs n on n.id=c.need_id join guests g on g.id=c.guest_id where n.party_id=v_party.id and n.kind='item' and c.status='delivered' and g.profile_id is not null and g.profile_id<>v_party.host_id;
 v_aura:=least(v_rules.max_aura_per_party,round(v_rules.aura_attendance*sqrt(v_attendees)+v_rules.aura_money*sqrt(v_funding)+v_rules.aura_supplies*sqrt(v_supplies)));
 -- Repeated groups have diminishing returns within a rolling month.
 v_aura:=round(v_aura/sqrt(1+(select count(*) from score_events e where e.profile_id=v_uid and category='aura' and created_at>now()-interval '30 days')));
 insert into score_events(party_id,profile_id,category,activity_key,value) values(v_party.id,v_uid,'aura','host:'||v_party.id,v_aura) on conflict(activity_key) do nothing;
 insert into user_achievements(profile_id,achievement_id) values(v_uid,'first-host') on conflict do nothing;
 end if;
 update parties set status='finalized',finalized_at=now(),rsvps_open=false where id=v_party.id;
 perform refresh_scores();
 v_result:=jsonb_build_object('ok',true,'verifiedParticipants',v_attendees,'auraAwarded',coalesce(v_aura,0),'party',party_snapshot(v_party.id,true,true));
 end if;
 insert into api_requests(scope,request_key,action,request_hash,response) values(v_scope,v_key,action,encode(digest(payload::text,'sha256'),'hex'),pgp_sym_encrypt(v_result::text,(select value from internal_secrets))); 
 insert into audit_events(party_id,actor_id,action,details) values(v_party.id,v_uid,action,jsonb_build_object('guestId',v_guest.id));
 return v_result;
end $$;
-- Internal helpers cannot be invoked as exposed PostgREST RPCs.
revoke all on function public.refresh_scores() from public,anon,authenticated;
revoke all on function public.party_snapshot(uuid,boolean,boolean) from public,anon,authenticated;
revoke all on function public.immutable_ledger() from public,anon,authenticated;
revoke all on function public.party_api(text,jsonb) from public;
grant execute on function public.party_api(text,jsonb) to anon,authenticated;

-- Corrections require trusted administration, append a reversal, and retain the original source.
create function public.reverse_score(p_event_id uuid,p_reason text) returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare e score_events%rowtype; result uuid;
begin
 if length(btrim(p_reason))<10 then raise exception 'An audit reason is required'; end if;
 select * into e from score_events where id=p_event_id and reverses_id is null;
 if not found then raise exception 'Original score event not found'; end if;
 insert into score_events(party_id,guest_id,profile_id,category,activity_key,value,weight,reverses_id) values(e.party_id,e.guest_id,e.profile_id,e.category,'reverse:'||e.id,-e.value,e.weight,e.id) returning id into result;
 insert into audit_events(party_id,action,details) values(e.party_id,'reverseScore',jsonb_build_object('eventId',e.id,'reason',p_reason));
 perform refresh_scores(); return result;
end $$;
revoke all on function public.reverse_score(uuid,text) from public,anon,authenticated;
grant execute on function public.reverse_score(uuid,text) to service_role;
