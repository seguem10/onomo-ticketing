-- ONOMO Support IT — prevent a user from bypassing the first-login gate.
-- The complete-first-login Edge Function uses the service role to clear this
-- field only after it has replaced the temporary password and required MFA.

begin;

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
       or new.must_change_password is distinct from old.must_change_password
       or new.pwd is distinct from old.pwd then
      raise exception 'Profile access-control fields can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_profile_privilege_update() from public, anon, authenticated;

commit;
