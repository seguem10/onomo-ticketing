-- ONOMO Support IT — requester assignment is limited to the requester's hotel.
-- Reuses utilisateurs.hotel (local IT/requester) and utilisateurs.hotels (regional IT).

begin;

create or replace function public.requester_available_it()
returns table(assigned_to uuid, prenom text, nom text, role text, scope_type text)
language sql stable security definer set search_path = public as $$
  with requester as (
    select trim(hotel) as hotel
    from public.utilisateurs
    where auth_user_id = auth.uid()
      and lower(trim(role)) in ('demandeur', 'requester')
      and nullif(trim(hotel), '') is not null
    limit 1
  )
  select distinct it.auth_user_id, it.prenom, it.nom,
    case when lower(trim(it.role)) = 'it_hotel' then 'it_hotel' else 'it_regional' end,
    case when lower(trim(it.role)) = 'it_hotel' then 'local' else 'regional' end
  from requester r
  join public.utilisateurs it on (
    (lower(trim(it.role)) = 'it_hotel' and trim(coalesce(it.hotel, '')) = r.hotel)
    or
    (lower(trim(it.role)) in ('it_regional', 'it régional')
      and jsonb_typeof(coalesce(it.hotels, '[]'::jsonb)) = 'array'
      and coalesce(it.hotels, '[]'::jsonb) @> jsonb_build_array(r.hotel))
  )
  where it.auth_user_id is not null
  order by 5, 2, 3;
$$;

create or replace function public.requester_can_assign_it(requester_id uuid, assignee_id uuid, ticket_hotel text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1
    from public.utilisateurs requester
    join public.utilisateurs it on it.auth_user_id = assignee_id
    where requester.auth_user_id = requester_id
      and lower(trim(requester.role)) in ('demandeur', 'requester')
      and nullif(trim(requester.hotel), '') is not null
      and trim(requester.hotel) = trim(ticket_hotel)
      and (
        (lower(trim(it.role)) = 'it_hotel' and trim(coalesce(it.hotel, '')) = trim(requester.hotel))
        or
        (lower(trim(it.role)) in ('it_regional', 'it régional')
          and jsonb_typeof(coalesce(it.hotels, '[]'::jsonb)) = 'array'
          and coalesce(it.hotels, '[]'::jsonb) @> jsonb_build_array(trim(requester.hotel)))
      )
  );
$$;

create or replace function public.guard_requester_ticket_assignment()
returns trigger
language plpgsql security definer set search_path = public as $$
declare actor_role text; canonical_name text;
begin
  select lower(trim(role)) into actor_role from public.utilisateurs where auth_user_id = auth.uid() limit 1;
  if actor_role in ('demandeur', 'requester') then
    if new.assigned_to is null then
      raise exception 'No authorised IT member is configured for this hotel';
    end if;
    if not public.requester_can_assign_it(auth.uid(), new.assigned_to, new.hotel) then
      raise exception 'Selected IT member is not authorised for the requester hotel';
    end if;
    select concat_ws(' ', prenom, nom) into canonical_name from public.utilisateurs where auth_user_id = new.assigned_to;
    new.assigne_a := nullif(trim(canonical_name), '');
  end if;
  return new;
end;
$$;

drop trigger if exists ab_guard_requester_ticket_assignment on public.tickets;
create trigger ab_guard_requester_ticket_assignment before insert or update on public.tickets
  for each row execute function public.guard_requester_ticket_assignment();

-- Keep the legacy RPC callable until the browser cache receives the new code,
-- but redact the two sensitive columns it used to expose. The new frontend
-- calls requester_available_it() exclusively.
create or replace function public.requester_it_users()
returns table(id text, prenom text, nom text, email text, role text, hotel text, hotels jsonb, auth_user_id uuid)
language sql stable security definer set search_path = public as $$
  select a.assigned_to::text, a.prenom, a.nom, null::text, a.role,
    null::text, '[]'::jsonb, a.assigned_to
  from public.requester_available_it() a;
$$;
revoke all on function public.requester_it_users() from public, anon;
grant execute on function public.requester_it_users() to authenticated;
revoke all on function public.requester_available_it() from public, anon;
revoke all on function public.requester_can_assign_it(uuid, uuid, text) from public, anon;
grant execute on function public.requester_available_it() to authenticated;

commit;
