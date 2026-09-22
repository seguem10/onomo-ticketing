-- ONOMO Support IT — fix ticket creation blocked by its audit history.
-- Run after ticketing_production_migration.sql and p1_ticket_history.sql.
-- A BEFORE INSERT trigger cannot insert a child row referencing NEW.id because
-- the parent ticket row is not visible to the foreign-key check yet.

begin;

create or replace function public.ticket_workflow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.ticket_number is null then
      new.ticket_number := nextval('public.ticket_number_seq');
    end if;
    if new.numero is null or new.numero = '' then
      new.numero := '#' || lpad(new.ticket_number::text, 6, '0');
    end if;
    new.updated_at := now();
    return new;
  end if;

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

create or replace function public.record_ticket_created_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.ticket_events(ticket_id, actor_id, action, new_values)
  values (new.id, auth.uid(), 'created', to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists ticket_created_event_trigger on public.tickets;
create trigger ticket_created_event_trigger
after insert on public.tickets
for each row execute function public.record_ticket_created_event();

revoke all on function public.record_ticket_created_event() from public, anon, authenticated;

commit;
