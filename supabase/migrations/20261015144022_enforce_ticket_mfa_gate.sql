-- SEC-08: permissive ownership/assignment policies must not bypass MFA.
-- AND-combined with existing policies; does not grant hotel or ticket access.
begin;

create policy tickets_mfa_gate
on public.tickets
as restrictive
for all
to authenticated
using ((select private.mfa_access_ok()))
with check ((select private.mfa_access_ok()));

commit;
