-- ONOMO Support IT — automatic, deduplicated SLA escalation.
-- Warning: assigned/local IT and the eligible regional IT are alerted at 70%.
-- Breach: eligible regional IT and all administrators are alerted at the deadline.
-- Critical: administrators are alerted again after one complete additional SLA period.

begin;

create extension if not exists pg_cron;

create table if not exists private.sla_escalation_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  stage text not null check (stage in ('warning', 'breach', 'critical')),
  recipient_id uuid not null,
  created_at timestamptz not null default now(),
  unique (ticket_id, stage, recipient_id)
);

alter table private.sla_escalation_events enable row level security;
revoke all on table private.sla_escalation_events from public, anon, authenticated;

create or replace function private.sla_escalation_recipient_ids(target_ticket uuid, escalation_stage text)
returns table (recipient_id uuid)
language sql
stable
security definer
set search_path = public, private
as $$
  select distinct u.auth_user_id
  from public.tickets t
  join public.utilisateurs u on u.auth_user_id is not null
  where t.id = target_ticket
    and escalation_stage in ('warning', 'breach', 'critical')
    and (
      (
        escalation_stage = 'warning'
        and (
          u.auth_user_id = t.assigned_to
          or (
            (lower(trim(coalesce(u.role, ''))) in ('it_hotel', 'it hotel')
              or coalesce(u.roles, '[]'::jsonb) ?| array['IT Hotel', 'it_hotel'])
            and trim(coalesce(u.hotel, '')) = trim(coalesce(t.hotel, ''))
          )
          or (
            (lower(trim(coalesce(u.role, ''))) in ('it_regional', 'it régional')
              or coalesce(u.roles, '[]'::jsonb) ?| array['IT Regional', 'it_regional'])
            and jsonb_typeof(coalesce(u.hotels, '[]'::jsonb)) = 'array'
            and coalesce(u.hotels, '[]'::jsonb) @> jsonb_build_array(trim(t.hotel))
          )
        )
      )
      or (
        escalation_stage = 'breach'
        and (
          lower(trim(coalesce(u.role, ''))) in ('admin', 'administrateur')
          or coalesce(u.roles, '[]'::jsonb) ?| array['Administrateur', 'admin']
          or (
            (lower(trim(coalesce(u.role, ''))) in ('it_regional', 'it régional')
              or coalesce(u.roles, '[]'::jsonb) ?| array['IT Regional', 'it_regional'])
            and jsonb_typeof(coalesce(u.hotels, '[]'::jsonb)) = 'array'
            and coalesce(u.hotels, '[]'::jsonb) @> jsonb_build_array(trim(t.hotel))
          )
        )
      )
      or (
        escalation_stage = 'critical'
        and (
          lower(trim(coalesce(u.role, ''))) in ('admin', 'administrateur')
          or coalesce(u.roles, '[]'::jsonb) ?| array['Administrateur', 'admin']
        )
      )
    );
$$;

create or replace function private.process_sla_escalations()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  candidate record;
  recipient record;
  notification_id uuid;
  sent_count integer := 0;
  body jsonb;
begin
  for candidate in
    select t.id, coalesce(t.numero, t.id::text) as ticket_number,
      case
        when now() >= t.sla_due_at + greatest(t.sla_due_at - coalesce(t.created_at, t.sla_due_at), interval '1 hour') then 'critical'
        when now() >= t.sla_due_at then 'breach'
        when now() >= coalesce(t.created_at, t.sla_due_at) + ((t.sla_due_at - coalesce(t.created_at, t.sla_due_at)) * 0.70) then 'warning'
      end as stage
    from public.tickets t
    where t.sla_due_at is not null
      and t.statut not in ('résolu', 'fermé')
      and now() >= coalesce(t.created_at, t.sla_due_at) + ((t.sla_due_at - coalesce(t.created_at, t.sla_due_at)) * 0.70)
  loop
    body := jsonb_build_object(
      'key', 'ticket_sla_' || candidate.stage,
      'ticket', candidate.ticket_number
    );
    for recipient in
      select recipient_id from private.sla_escalation_recipient_ids(candidate.id, candidate.stage)
    loop
      insert into private.sla_escalation_events (ticket_id, stage, recipient_id)
      values (candidate.id, candidate.stage, recipient.recipient_id)
      on conflict (ticket_id, stage, recipient_id) do nothing
      returning id into notification_id;

      if found then
        perform public.onomo_notify(recipient.recipient_id, candidate.id, 'sla_' || candidate.stage, body);
        sent_count := sent_count + 1;
      end if;
    end loop;
  end loop;

  return jsonb_build_object('notifications_created', sent_count, 'processed_at', now());
end;
$$;

revoke all on function private.sla_escalation_recipient_ids(uuid, text) from public, anon, authenticated;
revoke all on function private.process_sla_escalations() from public, anon, authenticated;

select cron.unschedule(jobid)
from cron.job
where jobname = 'onomo-sla-escalation';

select cron.schedule(
  'onomo-sla-escalation',
  '*/5 * * * *',
  'select private.process_sla_escalations();'
);

commit;
