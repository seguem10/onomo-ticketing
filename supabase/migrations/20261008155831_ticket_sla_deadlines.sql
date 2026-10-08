-- ONOMO Support IT — canonical SLA deadlines.
-- The deadline is calculated server-side so every client reports the same SLA.

begin;

alter table public.tickets
  add column if not exists sla_due_at timestamptz;

create index if not exists tickets_sla_due_at_open_idx
  on public.tickets (sla_due_at)
  where statut not in ('résolu', 'fermé');

create or replace function public.ticket_sla_due_at(priority_name text, opened_at timestamptz)
returns timestamptz
language sql
immutable
security invoker
set search_path = ''
as $$
  select opened_at + case lower(trim(coalesce(priority_name, '')))
    when 'urgente' then interval '1 hour'
    when 'haute' then interval '4 hours'
    when 'basse' then interval '72 hours'
    else interval '24 hours'
  end;
$$;

update public.tickets
set sla_due_at = public.ticket_sla_due_at(priorite, coalesce(created_at, now()))
where sla_due_at is null;

create or replace function public.set_ticket_sla_due_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.sla_due_at := public.ticket_sla_due_at(new.priorite, coalesce(new.created_at, now()));
  elsif new.priorite is distinct from old.priorite then
    -- Keep the original opening time: a priority change must not restart the SLA.
    new.sla_due_at := public.ticket_sla_due_at(new.priorite, coalesce(old.created_at, new.created_at, now()));
  else
    -- Never let a client directly move an SLA deadline.
    new.sla_due_at := old.sla_due_at;
  end if;

  return new;
end;
$$;

drop trigger if exists ad_set_ticket_sla_due_at on public.tickets;
create trigger ad_set_ticket_sla_due_at
before insert or update on public.tickets
for each row execute function public.set_ticket_sla_due_at();

revoke all on function public.ticket_sla_due_at(text, timestamptz) from public, anon, authenticated;
revoke all on function public.set_ticket_sla_due_at() from public, anon, authenticated;

commit;
