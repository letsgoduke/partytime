-- Execute only as the database migration owner. Runtime connections never own application objects.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='app_guest') then create role app_guest nologin noinherit; end if;
 if not exists(select 1 from pg_roles where rolname='app_user') then create role app_user nologin noinherit; end if;
 if not exists(select 1 from pg_roles where rolname='app_admin') then create role app_admin nologin noinherit; end if;
end $$;
create schema if not exists identity;
revoke all on schema identity from public;
create table if not exists identity.users(id uuid primary key,email text not null,email_confirmed_at timestamptz);
revoke all on identity.users from public,app_guest,app_user;
create or replace function identity.uid() returns uuid language sql stable set search_path=pg_catalog as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
revoke all on function identity.uid() from public;
grant usage on schema identity to app_guest,app_user;
grant execute on function identity.uid() to app_guest,app_user;
-- The Lambda invokes this before SET LOCAL ROLE, solely from verified API Gateway Cognito claims.
create or replace function identity.bootstrap_user(p_id uuid,p_email text) returns void language sql security definer set search_path=pg_catalog,identity as $$
 insert into identity.users(id,email,email_confirmed_at) values(p_id,p_email,now())
 on conflict(id) do update set email=excluded.email;
$$;
revoke all on function identity.bootstrap_user(uuid,text) from public,app_guest,app_user,app_admin;
