-- Planned maintenance: due tickets are created every morning by the
-- database, even when nobody opens the application (hotels without an IT
-- technician, weekends). The run on sign-in stays: whichever comes first
-- creates the ticket, and moving next_due prevents a second one.
begin;

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

      insert into public.tickets (titre, description, hotel, categorie, priorite, statut, created_by, created_by_email, created_by_name)
      values (
        plan.title,
        concat('[Maintenance planifiée — échéance du ', to_char(plan.next_due, 'DD/MM/YYYY'), ']', case when plan.description is not null then E'\n\n' || plan.description else '' end),
        plan.hotel, plan.category, plan.priority, 'nouveau', actor.auth_user_id, actor.email, coalesce(actor.name, 'Maintenance planifiée'))
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

-- Only the scheduler (database owner) runs it.
revoke all on function private.run_scheduled_maintenance_plans() from public, anon, authenticated;

-- Every day at 05:00 UTC (05:00 in Abidjan and Dakar, 06:00 in Casablanca).
select cron.unschedule(jobid) from cron.job where jobname = 'onomo-maintenance-plans';
select cron.schedule('onomo-maintenance-plans', '0 5 * * *', 'select private.run_scheduled_maintenance_plans();');

commit;
