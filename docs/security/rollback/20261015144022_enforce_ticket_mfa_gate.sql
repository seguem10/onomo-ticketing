-- Emergency rollback only: reintroduces SEC-08 (assigned-ticket MFA bypass).
-- Requires explicit environment approval. Does not alter other policies.
begin;
drop policy tickets_mfa_gate on public.tickets;
commit;
