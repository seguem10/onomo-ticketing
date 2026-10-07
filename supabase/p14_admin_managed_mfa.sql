-- ONOMO Support IT — administrator-managed MFA policy.
-- The policy flag is written to auth.app_metadata by the server-only Edge
-- Function. app_metadata cannot be altered by browser clients.

begin;

create or replace function private.mfa_access_ok() returns boolean
language sql stable security definer set search_path='' as $$
  select case
    when coalesce((select auth.jwt()->'app_metadata'->>'mfa_required'),'false')='true'
      then coalesce((select auth.jwt()->>'aal'),'aal1')='aal2'
    when (select private.user_has_verified_mfa())
      then coalesce((select auth.jwt()->>'aal'),'aal1')='aal2'
    else true
  end;
$$;

-- Legacy builds stored a browser-generated MFA secret in this column. Native
-- Supabase MFA keeps the secret in Auth only, so remove any legacy copies.
update public.utilisateurs set mfa_secret=null where mfa_secret is not null;

commit;
