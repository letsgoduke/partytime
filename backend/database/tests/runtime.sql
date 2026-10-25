-- Mirrors the IAM-only provisioner's restricted login privileges without touching the real login.
begin;
create role partytime_runtime_test nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant app_guest,app_user to partytime_runtime_test;
grant usage on schema identity to partytime_runtime_test;
grant execute on function identity.bootstrap_user(uuid,text) to partytime_runtime_test;
set local role partytime_runtime_test;
select identity.bootstrap_user('20000000-0000-0000-0000-000000000001','cognito@example.test');
do $$ declare denied boolean:=false; begin
 begin perform 1 from identity.users; exception when insufficient_privilege then denied:=true; end;
 assert denied,'Runtime login can read identity table directly';
 assert not has_function_privilege(current_user,'public.party_api(text,jsonb)','execute'),'Runtime login unexpectedly inherits browser role';
 assert not pg_has_role(current_user,'app_admin','MEMBER'),'Runtime login has administration role';
end $$;
set local role app_user;
select set_config('request.jwt.claim.sub','20000000-0000-0000-0000-000000000001',true);
select public.party_api('createParty',jsonb_build_object('title','AWS identity party','startsAt',now(),'idempotencyKey',gen_random_uuid()));
do $$ declare denied boolean:=false; begin
 begin perform identity.bootstrap_user('20000000-0000-0000-0000-000000000002','forged@example.test'); exception when insufficient_privilege then denied:=true; end;
 assert denied,'Browser-equivalent role can forge identities';
end $$;
reset role;
rollback;
