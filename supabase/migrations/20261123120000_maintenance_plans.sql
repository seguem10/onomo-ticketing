-- Planned maintenance: recurring tasks per hotel (check the backups every
-- month, test the UPS every quarter…). When a plan is due, a ticket is
-- created on behalf of a technician of that hotel, the next time one opens
-- the application (ticket checks need a signed-in user, so this cannot run
-- from a scheduler). One ticket per due date, even if several technicians
-- open the app at once; a plan that is long overdue creates one ticket and
-- moves to its next date after today.
begin;

create table if not exists public.maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  hotel text not null check (char_length(btrim(hotel)) between 1 and 120),
  title text not null check (char_length(btrim(title)) between 3 and 150),
  description text check (description is null or char_length(description) <= 2000),
  category text not null default 'IT / Réseau' check (category in ('Maintenance', 'IT / Réseau', 'Chambres', 'Restauration', 'Guest relations', 'Sécurité', 'Ménage', 'Autre')),
  priority text not null default 'Normale' check (priority in ('Basse', 'Normale', 'Haute', 'Urgente', 'Critique')),
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'semiannual', 'yearly')),
  next_due date not null,
  active boolean not null default true,
  last_run_at timestamptz,
  last_ticket_id uuid references public.tickets(id) on delete set null,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists maintenance_plans_due_idx on public.maintenance_plans (next_due) where active;

alter table public.maintenance_plans enable row level security;
revoke all on public.maintenance_plans from anon, authenticated;
grant select, delete on public.maintenance_plans to authenticated;
grant insert (hotel, title, description, category, priority, frequency, next_due, active) on public.maintenance_plans to authenticated;
grant update (hotel, title, description, category, priority, frequency, next_due, active) on public.maintenance_plans to authenticated;

drop policy if exists maintenance_plans_read on public.maintenance_plans;
create policy maintenance_plans_read on public.maintenance_plans for select to authenticated
  using ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)));
drop policy if exists maintenance_plans_insert on public.maintenance_plans;
create policy maintenance_plans_insert on public.maintenance_plans for insert to authenticated
  with check ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel))
              and created_by = (select auth.uid()));
drop policy if exists maintenance_plans_update on public.maintenance_plans;
create policy maintenance_plans_update on public.maintenance_plans for update to authenticated
  using ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)))
  with check ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)));
drop policy if exists maintenance_plans_delete on public.maintenance_plans;
create policy maintenance_plans_delete on public.maintenance_plans for delete to authenticated
  using ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)));

create or replace function public.maintenance_plans_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists maintenance_plans_touch on public.maintenance_plans;
create trigger maintenance_plans_touch before update on public.maintenance_plans
  for each row execute function public.maintenance_plans_touch();

create or replace function public.maintenance_next_due(from_date date, frequency text)
returns date
language sql
immutable
set search_path = ''
as $$
  select (from_date + case frequency
    when 'weekly' then interval '7 days'
    when 'monthly' then interval '1 month'
    when 'quarterly' then interval '3 months'
    when 'semiannual' then interval '6 months'
    else interval '1 year' end)::date;
$$;

-- Creates the tickets of the due plans the caller may handle, as the caller.
-- Returns the created tickets. A plan whose ticket cannot be created (for
-- example a check refuses it) is skipped and stays due.
create or replace function public.run_due_maintenance_plans()
returns table (plan_id uuid, ticket_id uuid, numero text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan public.maintenance_plans%rowtype;
  actor uuid := auth.uid();
  profile record;
  created record;
  next_date date;
begin
  if actor is null or not public.has_permission('ticket:update:all') then
    return;
  end if;
  select u.email, nullif(trim(concat_ws(' ', u.prenom, u.nom)), '') as name
    into profile from public.utilisateurs u where u.auth_user_id = actor;

  for plan in
    select * from public.maintenance_plans p
    where p.active and p.next_due <= current_date and public.user_has_hotel_scope(p.hotel)
    order by p.next_due
    for update skip locked
  loop
    begin
      insert into public.tickets (titre, description, hotel, categorie, priorite, statut, created_by, created_by_email, created_by_name)
      values (
        plan.title,
        concat('[Maintenance planifiée — échéance du ', to_char(plan.next_due, 'DD/MM/YYYY'), ']', case when plan.description is not null then E'\n\n' || plan.description else '' end),
        plan.hotel, plan.category, plan.priority, 'nouveau', actor, profile.email, coalesce(profile.name, 'Maintenance planifiée'))
      returning id, tickets.numero into created;

      next_date := plan.next_due;
      loop
        next_date := public.maintenance_next_due(next_date, plan.frequency);
        exit when next_date > current_date;
      end loop;
      update public.maintenance_plans
        set next_due = next_date, last_run_at = now(), last_ticket_id = created.id
        where id = plan.id;

      plan_id := plan.id; ticket_id := created.id; numero := created.numero;
      return next;
    exception when others then
      raise warning 'Maintenance plan % skipped: %', plan.id, sqlerrm;
    end;
  end loop;
end;
$$;
revoke all on function public.run_due_maintenance_plans() from public, anon;
grant execute on function public.run_due_maintenance_plans() to authenticated;

commit;
