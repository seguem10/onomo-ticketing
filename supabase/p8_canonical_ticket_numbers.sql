-- ONOMO Support IT — canonical, immutable ticket references.
-- Run after p6_ticket_creation_history_fix.sql. This is idempotent and does
-- not modify existing ticket references.

begin;

create sequence if not exists public.ticket_number_seq start 1000;

-- Move the sequence past every existing reference before the next insert.
select setval(
  'public.ticket_number_seq',
  greatest(1000, coalesce((select max(ticket_number) from public.tickets), 0)),
  true
);

create or replace function public.ticket_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Ignore any client supplied reference. Only this sequence can allocate a
    -- production ticket number, preventing collisions and later reuse.
    new.ticket_number := nextval('public.ticket_number_seq');
    new.numero := '#' || lpad(new.ticket_number::text, 6, '0');
    new.updated_at := now();
    return new;
  end if;

  -- A ticket reference is permanent for its entire lifecycle.
  new.ticket_number := old.ticket_number;
  new.numero := old.numero;

  if new.statut = 'résolu' then
    new.statut := 'fermé';
  end if;
  if old.statut = 'fermé'
     and new.statut not in ('fermé', 'nouveau')
     and not public.has_permission('ticket:reopen')
     and not public.has_permission('*') then
    raise exception 'Ticket closed';
  end if;
  if old.statut = 'fermé' and new.statut = 'nouveau' then
    new.closed_at := null;
  end if;
  if new.statut = 'fermé' and old.statut is distinct from 'fermé' then
    new.closed_at := now();
  end if;

  new.updated_at := now();
  insert into public.ticket_events(ticket_id, actor_id, action, old_values, new_values)
  values (
    new.id,
    auth.uid(),
    case
      when old.statut = 'fermé' and new.statut = 'nouveau' then 'reopened'
      when new.statut = 'fermé' then 'closed'
      when old.assigne_a is distinct from new.assigne_a then 'reassigned'
      else 'updated'
    end,
    to_jsonb(old),
    to_jsonb(new)
  );
  return new;
end;
$$;

revoke all on function public.ticket_workflow() from public, anon, authenticated;

commit;
