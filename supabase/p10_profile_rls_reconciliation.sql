-- ONOMO Support IT — reconcile profile RLS policies.
--
-- PostgreSQL combines permissive policies with OR.  This migration removes
-- every legacy policy on public.utilisateurs, then recreates the only four
-- policies supported by the application.  Run after p4 and p9.
--
-- A standard authenticated user can read or update only their own profile;
-- the privilege-guard trigger below permits only personal preferences on
-- that update.  Only an Administrator can manage other profiles.

begin;

alter table public.utilisateurs enable row level security;

do $$
declare
  existing_policy text;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'utilisateurs'
  loop
    execute format('drop policy if exists %I on public.utilisateurs', existing_policy);
  end loop;
end;
$$;

create policy utilisateurs_read
  on public.utilisateurs for select to authenticated
  using (auth_user_id = (select auth.uid()) or (select public.is_admin()));

create policy utilisateurs_insert
  on public.utilisateurs for insert to authenticated
  with check ((select public.is_admin()));

create policy utilisateurs_update
  on public.utilisateurs for update to authenticated
  using (auth_user_id = (select auth.uid()) or (select public.is_admin()))
  with check (auth_user_id = (select auth.uid()) or (select public.is_admin()));

create policy utilisateurs_delete
  on public.utilisateurs for delete to authenticated
  using ((select public.is_admin()));

-- Keep the protection self-contained: an owner may change profile details
-- such as preferred language, but never role, assigned hotels, MFA state,
-- account ownership or legacy password data.
create or replace function public.guard_profile_privilege_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.auth_user_id = auth.uid() and not public.is_admin() then
    if new.auth_user_id is distinct from old.auth_user_id
       or new.role is distinct from old.role
       or new.roles is distinct from old.roles
       or new.hotel is distinct from old.hotel
       or new.hotels is distinct from old.hotels
       or new.mfa_enabled is distinct from old.mfa_enabled
       or new.mfa_secret is distinct from old.mfa_secret
       or new.pwd is distinct from old.pwd then
      raise exception 'Profile access-control fields can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists onomo_guard_profile_privilege_update on public.utilisateurs;
create trigger onomo_guard_profile_privilege_update
  before update on public.utilisateurs
  for each row execute function public.guard_profile_privilege_update();

revoke all on function public.guard_profile_privilege_update() from public, anon, authenticated;
revoke all on table public.utilisateurs from anon;
grant select, insert, update, delete on table public.utilisateurs to authenticated;

commit;
