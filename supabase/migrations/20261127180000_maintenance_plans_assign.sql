-- Planned maintenance tickets are assigned when they are created: to the
-- hotel's IT technician, else to a regional IT covering the hotel. Both the
-- run on sign-in and the daily job use the same rule.
begin;

-- Who handles a hotel's maintenance tickets (null when nobody fits).
create or replace function private.maintenance_assignee(hotel_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.auth_user_id
  from public.utilisateurs u
  where u.auth_user_id is not null
    and (
      (lower(trim(coalesce(u.role, ''))) = 'it_hotel' and trim(coalesce(u.hotel, '')) = trim(hotel_name))
      or (lower(trim(coalesce(u.role, ''))) = 'it_regional'
          and jsonb_typeof(coalesce(u.hotels, '[]'::jsonb)) = 'array'
          and coalesce(u.hotels, '[]'::jsonb) @> jsonb_build_array(trim(hotel_name)))
    )
    and private.ticket_assignee_is_eligible(u.auth_user_id, hotel_name)
  order by case lower(trim(coalesce(u.role, ''))) when 'it_hotel' then 1 else 2 end, u.created_at
  limit 1;
$$;
revoke all on function private.maintenance_assignee(text) from public, anon, authenticated;

-- Run on sign-in (unchanged, plus the assignee).
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
  assignee uuid;
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
      assignee := private.maintenance_assignee(plan.hotel);
      -- The assignment checks need an actor who manages the hotel.
      if assignee is not null and not private.assignment_actor_can_manage_hotel(actor, plan.hotel) then
        assignee := null;
      end if;
      insert into public.tickets (titre, description, hotel, categorie, priorite, statut, created_by, created_by_email, created_by_name, assigned_to)
      values (
        plan.title,
        concat('[Maintenance planifiée — échéance du ', to_char(plan.next_due, 'DD/MM/YYYY'), ']', case when plan.description is not null then E'\n\n' || plan.description else '' end),
        plan.hotel, plan.category, plan.priority, 'nouveau', actor, profile.email, coalesce(profile.name, 'Maintenance planifiée'), assignee)
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

-- Daily job (unchanged, plus the assignee).
create or replace function private.run_scheduled_maintenance_plans()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan public.maintenance_plans%rowtype;
  actor record;
  created record;
  next_date date;
  assignee uuid;
  total integer := 0;
begin
  for plan in
    select * from public.maintenance_plans p
    where p.active and p.next_due <= current_date
    order by p.hotel, p.next_due
    for update skip locked
  loop
    begin
      -- The ticket is created in the name of the hotel's IT technician,
      -- else a regional IT covering the hotel, else an administrator.
      select u.auth_user_id, u.email, nullif(trim(concat_ws(' ', u.prenom, u.nom)), '') as name
        into actor
      from public.utilisateurs u
      where u.auth_user_id is not null
        and (
          (lower(trim(coalesce(u.role, ''))) = 'it_hotel' and trim(coalesce(u.hotel, '')) = trim(plan.hotel))
          or (lower(trim(coalesce(u.role, ''))) = 'it_regional'
              and jsonb_typeof(coalesce(u.hotels, '[]'::jsonb)) = 'array'
              and coalesce(u.hotels, '[]'::jsonb) @> jsonb_build_array(trim(plan.hotel)))
          or lower(trim(coalesce(u.role, ''))) = 'admin'
        )
      order by case lower(trim(coalesce(u.role, ''))) when 'it_hotel' then 1 when 'it_regional' then 2 else 3 end, u.created_at
      limit 1;
      if actor.auth_user_id is null then
        raise warning 'Maintenance plan % skipped: no IT account for hotel %', plan.id, plan.hotel;
        continue;
      end if;
      -- The ticket checks (hotel scope, history) read the creator from auth.uid().
      perform set_config('request.jwt.claim.sub', actor.auth_user_id::text, true);
      assignee := private.maintenance_assignee(plan.hotel);

      insert into public.tickets (titre, description, hotel, categorie, priorite, statut, created_by, created_by_email, created_by_name, assigned_to)
      values (
        plan.title,
        concat('[Maintenance planifiée — échéance du ', to_char(plan.next_due, 'DD/MM/YYYY'), ']', case when plan.description is not null then E'\n\n' || plan.description else '' end),
        plan.hotel, plan.category, plan.priority, 'nouveau', actor.auth_user_id, actor.email, coalesce(actor.name, 'Maintenance planifiée'), assignee)
      returning id into created;

      next_date := plan.next_due;
      loop
        next_date := public.maintenance_next_due(next_date, plan.frequency);
        exit when next_date > current_date;
      end loop;
      update public.maintenance_plans
        set next_due = next_date, last_run_at = now(), last_ticket_id = created.id
        where id = plan.id;
      total := total + 1;
    exception when others then
      raise warning 'Maintenance plan % skipped: %', plan.id, sqlerrm;
    end;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  return total;
end;
$$;
revoke all on function private.run_scheduled_maintenance_plans() from public, anon, authenticated;

commit;
