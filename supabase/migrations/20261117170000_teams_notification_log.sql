-- One Teams alert per ticket and event (urgent ticket created, SLA breached,
-- SLA critical). Written and read only by the Edge Functions with the service
-- role: RLS is on and no policy is granted to app users.
begin;

create table if not exists public.teams_notification_log (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  event text not null check (event in ('urgent_created', 'sla_breach', 'sla_critical')),
  sent_at timestamptz not null default now(),
  primary key (ticket_id, event)
);

alter table public.teams_notification_log enable row level security;
revoke all on public.teams_notification_log from anon, authenticated;

commit;
