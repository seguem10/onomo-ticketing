-- ONOMO Support IT — secure server-side e-mail delivery for SLA escalation.
-- Only the service-role Edge Function can claim or complete e-mail work.

begin;

alter table private.sla_escalation_events
  add column if not exists email_attempts integer not null default 0,
  add column if not exists email_claimed_at timestamptz,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_last_error text;

create index if not exists sla_escalation_events_email_pending_idx
  on private.sla_escalation_events (created_at)
  where email_sent_at is null and email_attempts < 5;

create or replace function public.claim_sla_escalation_email_batch(batch_limit integer default 25)
returns table (
  event_id uuid,
  ticket_id uuid,
  escalation_stage text,
  recipient_email text,
  recipient_first_name text,
  recipient_last_name text,
  ticket_number text,
  ticket_title text,
  ticket_hotel text,
  ticket_priority text,
  ticket_status text
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role required';
  end if;

  return query
  with claimable as (
    select e.id
    from private.sla_escalation_events e
    join public.tickets t on t.id = e.ticket_id
    join public.utilisateurs u on u.auth_user_id = e.recipient_id
    where e.email_sent_at is null
      and e.email_attempts < 5
      and (e.email_claimed_at is null or e.email_claimed_at < now() - interval '15 minutes')
      and t.statut not in ('résolu', 'fermé')
      and nullif(trim(coalesce(u.email, '')), '') is not null
    order by e.created_at
    limit greatest(1, least(coalesce(batch_limit, 25), 100))
    for update of e skip locked
  ), claimed as (
    update private.sla_escalation_events e
    set email_claimed_at = now(),
        email_attempts = e.email_attempts + 1,
        email_last_error = null
    from claimable c
    where e.id = c.id
    returning e.id, e.ticket_id, e.stage, e.recipient_id
  )
  select c.id, c.ticket_id, c.stage, u.email, u.prenom, u.nom,
         coalesce(t.numero, t.id::text), t.titre, t.hotel, t.priorite, t.statut
  from claimed c
  join public.tickets t on t.id = c.ticket_id
  join public.utilisateurs u on u.auth_user_id = c.recipient_id;
end;
$$;

create or replace function public.complete_sla_escalation_email_delivery(
  target_event uuid,
  delivered boolean,
  failure_message text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role required';
  end if;

  update private.sla_escalation_events
  set email_sent_at = case when delivered then now() else email_sent_at end,
      email_claimed_at = null,
      email_last_error = case
        when delivered then null
        else left(coalesce(failure_message, 'Échec temporaire du fournisseur e-mail.'), 500)
      end
  where id = target_event;

  return found;
end;
$$;

revoke all on function public.claim_sla_escalation_email_batch(integer) from public, anon, authenticated;
revoke all on function public.complete_sla_escalation_email_delivery(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_sla_escalation_email_batch(integer) to service_role;
grant execute on function public.complete_sla_escalation_email_delivery(uuid, boolean, text) to service_role;

commit;
