-- The ticket trigger runs with the submitting user's database role.  The SLA
-- calculator is a pure, immutable timestamp calculation, so authenticated
-- users may execute it while the trigger remains the only mechanism that
-- writes tickets.sla_due_at.

begin;

revoke all on function public.ticket_sla_due_at(text, timestamptz) from public, anon;
grant execute on function public.ticket_sla_due_at(text, timestamptz) to authenticated;

-- The trigger itself must not be callable from the Data API.
revoke all on function public.set_ticket_sla_due_at() from public, anon, authenticated;

commit;
