begin;

-- Storage policies execute this boolean MFA check as the signed-in user.
-- Keep the check itself and all object ownership policies unchanged.
grant execute on function private.mfa_access_ok() to authenticated;

commit;
