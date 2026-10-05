-- Server-side notification throttle.  Browser code is not trusted to prevent
-- repeated mail delivery requests, so each user may notify recipients about a
-- given ticket/event only once every 30 seconds.
begin;

create table if not exists public.notification_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  event text not null check (event in ('created', 'updated', 'comment', 'attachment')),
  actor_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.notification_delivery_attempts enable row level security;
revoke all on public.notification_delivery_attempts from anon;
grant select, insert on public.notification_delivery_attempts to authenticated;

drop policy if exists notification_delivery_attempts_read_own on public.notification_delivery_attempts;
create policy notification_delivery_attempts_read_own
  on public.notification_delivery_attempts for select to authenticated
  using (actor_id = (select auth.uid()));

drop policy if exists notification_delivery_attempts_insert_own on public.notification_delivery_attempts;
create policy notification_delivery_attempts_insert_own
  on public.notification_delivery_attempts for insert to authenticated
  with check (actor_id = (select auth.uid()));

create index if not exists notification_delivery_attempts_rate_limit_idx
  on public.notification_delivery_attempts (ticket_id, event, actor_id, created_at desc);

create or replace function public.claim_ticket_notification_delivery(
  target_ticket uuid,
  target_event text
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  last_delivery timestamptz;
begin
  if auth.uid() is null or target_event not in ('created', 'updated', 'comment', 'attachment') then
    return false;
  end if;

  -- This SELECT remains subject to ticket RLS, proving that the caller may
  -- see the ticket before a delivery attempt can be created.
  perform 1 from public.tickets where id = target_ticket;
  if not found then
    return false;
  end if;

  select created_at into last_delivery
  from public.notification_delivery_attempts
  where ticket_id = target_ticket
    and event = target_event
    and actor_id = (select auth.uid())
  order by created_at desc
  limit 1;

  if last_delivery is not null and last_delivery > now() - interval '30 seconds' then
    return false;
  end if;

  insert into public.notification_delivery_attempts (ticket_id, event, actor_id)
  values (target_ticket, target_event, (select auth.uid()));
  return true;
end;
$$;

revoke all on function public.claim_ticket_notification_delivery(uuid, text) from public, anon;
grant execute on function public.claim_ticket_notification_delivery(uuid, text) to authenticated;

commit;
