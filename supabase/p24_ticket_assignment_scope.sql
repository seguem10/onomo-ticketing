-- ONOMO Support IT — assignment candidates by ticket hotel.
-- IT Hotel: same hotel only. IT Regional: only covered hotels.
-- Administrators are always offered as an escalation destination.

begin;

create or replace function private.ticket_assignee_is_eligible(assignee_id uuid, ticket_hotel text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.utilisateurs u
    where u.auth_user_id=assignee_id
      and (
        lower(trim(coalesce(u.role,''))) in ('admin','administrateur')
        or (lower(trim(coalesce(u.role,''))) in ('it_hotel','it hotel') and trim(coalesce(u.hotel,''))=trim(ticket_hotel))
        or (lower(trim(coalesce(u.role,''))) in ('it_regional','it régional')
            and jsonb_typeof(coalesce(u.hotels,'[]'::jsonb))='array'
            and coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(trim(ticket_hotel)))
      )
  );
$$;

create or replace function private.assignment_actor_can_manage_hotel(actor_id uuid, ticket_hotel text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.utilisateurs u
    where u.auth_user_id=actor_id
      and (
        lower(trim(coalesce(u.role,''))) in ('admin','administrateur')
        or (lower(trim(coalesce(u.role,''))) in ('it_hotel','it hotel','demandeur','requester') and trim(coalesce(u.hotel,''))=trim(ticket_hotel))
        or (lower(trim(coalesce(u.role,''))) in ('it_regional','it régional')
            and jsonb_typeof(coalesce(u.hotels,'[]'::jsonb))='array'
            and coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(trim(ticket_hotel)))
      )
  );
$$;

create or replace function public.ticket_assignment_candidates(ticket_hotel text)
returns table(assigned_to uuid, prenom text, nom text, role text, scope_type text)
language sql stable security definer set search_path = public as $$
  select u.auth_user_id,u.prenom,u.nom,u.role,
    case
      when lower(trim(coalesce(u.role,''))) in ('admin','administrateur') then 'admin'
      when lower(trim(coalesce(u.role,''))) in ('it_regional','it régional') then 'regional'
      else 'local'
    end
  from public.utilisateurs u
  where nullif(trim(ticket_hotel),'') is not null
    and private.assignment_actor_can_manage_hotel(auth.uid(),ticket_hotel)
    and u.auth_user_id is not null
    and private.ticket_assignee_is_eligible(u.auth_user_id,ticket_hotel)
  order by
    case
      when lower(trim(coalesce(u.role,''))) in ('it_hotel','it hotel') then 1
      when lower(trim(coalesce(u.role,''))) in ('it_regional','it régional') then 2
      else 3
    end,
    lower(u.prenom),lower(u.nom);
$$;

-- Keep the requester flow compatible while adding the administrator escalation
-- option to the same authoritative candidate list.
create or replace function public.requester_available_it()
returns table(assigned_to uuid, prenom text, nom text, role text, scope_type text)
language sql stable security definer set search_path = public as $$
  select c.assigned_to,c.prenom,c.nom,c.role,c.scope_type
  from public.ticket_assignment_candidates((
    select trim(hotel) from public.utilisateurs
    where auth_user_id=auth.uid() and lower(trim(coalesce(role,''))) in ('demandeur','requester')
    limit 1
  )) c;
$$;

create or replace function public.requester_can_assign_it(requester_id uuid, assignee_id uuid, ticket_hotel text)
returns boolean
language sql stable security definer set search_path = public as $$
  select requester_id=auth.uid()
    and private.assignment_actor_can_manage_hotel(requester_id,ticket_hotel)
    and private.ticket_assignee_is_eligible(assignee_id,ticket_hotel);
$$;

create or replace function public.guard_ticket_assignment_scope()
returns trigger
language plpgsql security definer set search_path = public as $$
declare canonical_name text;
begin
  if tg_op='UPDATE'
     and new.assigned_to is not distinct from old.assigned_to
     and new.assigne_a is not distinct from old.assigne_a
     and new.hotel is not distinct from old.hotel then
    return new;
  end if;

  if not private.assignment_actor_can_manage_hotel(auth.uid(),new.hotel) then
    raise exception 'You cannot assign tickets for this hotel';
  end if;

  if new.assigned_to is null then
    if nullif(trim(coalesce(new.assigne_a,'')),'') is not null then
      raise exception 'An assignee must be selected from the authorised list';
    end if;
    return new;
  end if;

  if not private.ticket_assignee_is_eligible(new.assigned_to,new.hotel) then
    raise exception 'Selected assignee is not authorised for this ticket hotel';
  end if;

  select nullif(trim(concat_ws(' ',prenom,nom)),'') into canonical_name
  from public.utilisateurs where auth_user_id=new.assigned_to;
  new.assigne_a:=canonical_name;
  return new;
end;
$$;

drop trigger if exists ac_guard_ticket_assignment_scope on public.tickets;
create trigger ac_guard_ticket_assignment_scope
  before insert or update of assigned_to,assigne_a,hotel on public.tickets
  for each row execute function public.guard_ticket_assignment_scope();

revoke all on function public.ticket_assignment_candidates(text) from public, anon;
grant execute on function public.ticket_assignment_candidates(text) to authenticated;
revoke all on function public.guard_ticket_assignment_scope() from public, anon, authenticated;

commit;
