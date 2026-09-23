-- ONOMO Support IT — strict ticket write authorization.
-- Run after p10_profile_rls_reconciliation.sql.
--
-- PostgreSQL combines permissive policies with OR. Rebuild every ticket
-- policy so no legacy owner-write or allow-all policy can survive. A requester
-- creates and reads their tickets, then uses commentaires for follow-up;
-- ticket lifecycle changes are an authorised IT operation.

begin;

alter table public.tickets enable row level security;

do $$
declare
  existing_policy text;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tickets'
  loop
    execute format('drop policy if exists %I on public.tickets', existing_policy);
  end loop;
end;
$$;

create policy tickets_read
  on public.tickets for select to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.has_permission('ticket:read:all'))
      and (select public.user_has_hotel_scope(hotel))
    )
    or (
      (select public.has_permission('ticket:read:own'))
      and created_by = (select auth.uid())
    )
    or assigned_to = (select auth.uid())
  );

create policy tickets_create
  on public.tickets for insert to authenticated
  with check (
    (select public.has_permission('ticket:create'))
    and created_by = (select auth.uid())
    and (select public.user_has_hotel_scope(hotel))
  );

-- IT Hotel / IT Regional receive ticket:update:all in p0. The optional
-- ticket:update:assigned permission supports a tightly scoped custom role.
create policy tickets_update
  on public.tickets for update to authenticated
  using (
    (select public.is_admin())
    or (
      (select public.has_permission('ticket:update:all'))
      and (select public.user_has_hotel_scope(hotel))
    )
    or (
      (select public.has_permission('ticket:update:assigned'))
      and assigned_to = (select auth.uid())
    )
  )
  with check (
    (select public.is_admin())
    or (
      (select public.has_permission('ticket:update:all'))
      and (select public.user_has_hotel_scope(hotel))
    )
    or (
      (select public.has_permission('ticket:update:assigned'))
      and assigned_to = (select auth.uid())
    )
  );

create policy tickets_delete
  on public.tickets for delete to authenticated
  using ((select public.is_admin()));

create or replace function public.guard_ticket_write_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ticket ownership is immutable: neither an IT user nor an administrator
  -- should rewrite the identity of the requester while updating a ticket.
  if new.created_by is distinct from old.created_by then
    raise exception 'Ticket creator cannot be changed';
  end if;

  -- A custom assigned-agent role may work only on tickets still assigned to
  -- that same agent and may not move a ticket to a different hotel.
  if not public.is_admin() and not public.has_permission('ticket:update:all') then
    if old.assigned_to is distinct from auth.uid()
       or new.assigned_to is distinct from auth.uid()
       or new.hotel is distinct from old.hotel then
      raise exception 'Assigned agents can update only their own hotel tickets';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists onomo_guard_ticket_write_scope on public.tickets;
create trigger onomo_guard_ticket_write_scope
  before update on public.tickets
  for each row execute function public.guard_ticket_write_scope();

revoke all on function public.guard_ticket_write_scope() from public, anon, authenticated;
revoke all on table public.tickets from anon;
grant select, insert, update, delete on table public.tickets to authenticated;

commit;
