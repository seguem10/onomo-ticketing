-- ONOMO Support IT — prevent profile self-privilege escalation.
-- Run after p3_settings_security_reconciliation.sql.
-- Supabase Auth remains the only password authority; public.utilisateurs is a
-- profile table and must never be used to grant a role or change scope.

begin;

create or replace function public.guard_profile_privilege_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Administrators retain the managed-user workflow. A profile owner may keep
  -- personal preferences (such as language) and password-change state, but
  -- cannot change any access-control, scope, MFA or legacy password fields.
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

commit;
