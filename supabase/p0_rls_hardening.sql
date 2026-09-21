-- ONOMO Support IT — P0 RLS hardening.
-- Run this AFTER secure_roles_migration.sql and ticketing_production_migration.sql.
-- This script is idempotent and deliberately does not alter business ticket data.

begin;

create schema if not exists private;

-- Explicit per-hotel scopes for future teams; existing utilisateurs.hotel(s)
-- remain supported by user_has_hotel_scope for backward compatibility.
create table if not exists public.user_hotel_scopes (
  user_id uuid not null references auth.users(id) on delete cascade,
  hotel text not null,
  primary key (user_id, hotel)
);
alter table public.user_hotel_scopes enable row level security;

create or replace function private.user_has_verified_mfa() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from auth.mfa_factors f
    where f.user_id=(select auth.uid()) and f.status='verified'
  );
$$;

create or replace function private.mfa_access_ok() returns boolean
language sql stable security definer set search_path='' as $$
  select not (select private.user_has_verified_mfa())
    or coalesce((select auth.jwt()->>'aal'),'aal1')='aal2';
$$;

create or replace function public.has_permission(permission_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select (select private.mfa_access_ok()) and exists(
    select 1
    from public.app_user_roles ur
    join public.app_roles r on r.id=ur.role_id
    where ur.user_id=(select auth.uid())
      and (r.name='Administrateur' or r.permissions ? '*' or r.permissions ? permission_name)
  );
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select (select private.mfa_access_ok()) and exists(
    select 1 from public.app_user_roles ur
    join public.app_roles r on r.id=ur.role_id
    where ur.user_id=(select auth.uid()) and r.name='Administrateur'
  );
$$;

create or replace function public.user_has_hotel_scope(hotel_name text) returns boolean
language sql stable security definer set search_path='' as $$
  select (select public.is_admin())
    or exists(select 1 from public.user_hotel_scopes s where s.user_id=(select auth.uid()) and s.hotel=hotel_name)
    or exists(
      select 1 from public.utilisateurs u
      where u.auth_user_id=(select auth.uid())
        and (u.hotel=hotel_name or coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(hotel_name))
    );
$$;

drop policy if exists user_hotel_scopes_admin_manage on public.user_hotel_scopes;
create policy user_hotel_scopes_admin_manage on public.user_hotel_scopes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Preserve the legacy wildcard role values while making standard requester
-- comments possible. New custom roles remain entirely permission-driven.
update public.app_roles
set permissions='["ticket:create","ticket:read:own","comment:create","comment:read:own"]'::jsonb
where name='Demandeur';

drop policy if exists tickets_read on public.tickets;
drop policy if exists tickets_create on public.tickets;
drop policy if exists tickets_update on public.tickets;
drop policy if exists tickets_delete on public.tickets;
create policy tickets_read on public.tickets for select to authenticated using (
  (select public.is_admin())
  or ((select public.has_permission('ticket:read:all')) and (select public.user_has_hotel_scope(hotel)))
  or ((select public.has_permission('ticket:read:own')) and created_by=(select auth.uid()))
  or assigned_to=(select auth.uid())
);
create policy tickets_create on public.tickets for insert to authenticated with check (
  (select public.has_permission('ticket:create'))
  and created_by=(select auth.uid())
  and (select public.user_has_hotel_scope(hotel))
);
create policy tickets_update on public.tickets for update to authenticated using (
  (select public.is_admin())
  or ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)))
  or created_by=(select auth.uid())
  or assigned_to=(select auth.uid())
) with check (
  (select public.is_admin())
  or ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)))
  or created_by=(select auth.uid())
  or assigned_to=(select auth.uid())
);
create policy tickets_delete on public.tickets for delete to authenticated using ((select public.is_admin()));

-- Requesters may amend their own description, but may never self-assign,
-- alter priority/status, move the ticket to another hotel, or change ownership.
create or replace function public.guard_requester_ticket_update() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Ticket creator cannot be changed';
  end if;
  if old.created_by=auth.uid()
     and not public.is_admin()
     and not public.has_permission('ticket:update:all') then
    if new.assigned_to is distinct from old.assigned_to
       or new.assigne_a is distinct from old.assigne_a
       or new.statut is distinct from old.statut
       or new.priorite is distinct from old.priorite
       or new.hotel is distinct from old.hotel then
      raise exception 'Only authorised support staff may change assignment, status, priority, or hotel';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists aa_guard_requester_ticket_update on public.tickets;
create trigger aa_guard_requester_ticket_update
  before update on public.tickets for each row execute function public.guard_requester_ticket_update();

-- Ticket event visibility must inherit the ticket's RLS scope, not a broad role.
alter table public.ticket_events enable row level security;
drop policy if exists ticket_events_read on public.ticket_events;
create policy ticket_events_read on public.ticket_events for select to authenticated using (
  exists(select 1 from public.tickets t where t.id=ticket_events.ticket_id)
);

commit;
