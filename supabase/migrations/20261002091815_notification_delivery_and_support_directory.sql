-- ONOMO Support IT — one notification pipeline for ticket activity and a
-- safe support directory.  This migration deliberately exposes neither
-- passwords, MFA secrets nor requester accounts to support staff.

begin;

-- The web client asks only for the connected user's permissions. Keeping this
-- helper alongside the directory migration prevents a missing-RPC fallback
-- from weakening or hiding the IT Hotel / IT Regional interface.
create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct permission order by permission), '{}'::text[])
  from public.app_user_roles ur
  join public.app_roles r on r.id = ur.role_id
  cross join lateral jsonb_array_elements_text(r.permissions) as permission
  where ur.user_id = (select auth.uid());
$$;

revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

-- The directory is returned through a narrowly scoped RPC rather than by
-- widening SELECT access to public.utilisateurs (which contains sensitive
-- profile columns). Administrators and support roles can see support peers.
create or replace function public.get_support_directory()
returns table (
  id uuid,
  auth_user_id uuid,
  email text,
  prenom text,
  nom text,
  role text,
  roles jsonb,
  hotel text,
  hotels jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not (
    (select public.is_admin())
    or exists (
      select 1
      from public.app_user_roles ur
      join public.app_roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.name in ('IT Hotel', 'IT Regional', 'Administrateur')
    )
  ) then
    raise exception 'Support directory access denied';
  end if;

  return query
  select u.id, u.auth_user_id, u.email, u.prenom, u.nom, u.role,
         coalesce(u.roles, '[]'::jsonb), u.hotel, coalesce(u.hotels, '[]'::jsonb), u.created_at
  from public.utilisateurs u
  where u.auth_user_id is not null
    and (
      lower(coalesce(u.role, '')) in ('admin', 'administrateur', 'it_regional', 'it regional', 'it_hotel', 'it hotel')
      or coalesce(u.roles, '[]'::jsonb) ?| array['Administrateur', 'IT Regional', 'IT Hotel', 'admin', 'it_regional', 'it_hotel']
    )
  order by lower(coalesce(u.nom, '')), lower(coalesce(u.prenom, '')), lower(u.email);
end;
$$;

revoke all on function public.get_support_directory() from public, anon;
grant execute on function public.get_support_directory() to authenticated;

-- Recipient resolution is centralised in the database so a browser cannot
-- choose who receives an alert. Directly assigned users are always included;
-- administrators and regional IT are informed, and hotel IT is limited to
-- the ticket hotel. The ticket requester is included for follow-up events.
create or replace function public.ticket_notification_recipient_ids(target_ticket uuid)
returns table (recipient_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct u.auth_user_id
  from public.tickets t
  join public.utilisateurs u on u.auth_user_id is not null
  where t.id = target_ticket
    and (
      u.auth_user_id = t.created_by
      or u.auth_user_id = t.assigned_to
      or lower(coalesce(u.role, '')) in ('admin', 'administrateur', 'it_regional', 'it regional')
      or coalesce(u.roles, '[]'::jsonb) ?| array['Administrateur', 'IT Regional', 'admin', 'it_regional']
      or (
        (
          lower(coalesce(u.role, '')) in ('it_hotel', 'it hotel')
          or coalesce(u.roles, '[]'::jsonb) ?| array['IT Hotel', 'it_hotel']
        )
        and (
          u.hotel = t.hotel
          or coalesce(u.hotels, '[]'::jsonb) @> jsonb_build_array(t.hotel)
        )
      )
    );
$$;

revoke all on function public.ticket_notification_recipient_ids(uuid) from public, anon, authenticated;

create or replace function public.onomo_ticket_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  body jsonb;
begin
  if tg_op = 'INSERT' then
    body := jsonb_build_object('key', 'ticket_created', 'ticket', coalesce(new.numero, new.id::text));
    for recipient in select recipient_id from public.ticket_notification_recipient_ids(new.id)
    loop
      perform public.onomo_notify(recipient, new.id, 'created', body);
    end loop;
    return new;
  end if;

  if old.titre is not distinct from new.titre
     and old.description is not distinct from new.description
     and old.categorie is not distinct from new.categorie
     and old.priorite is not distinct from new.priorite
     and old.statut is not distinct from new.statut
     and old.assigne_a is not distinct from new.assigne_a
     and old.assigned_to is not distinct from new.assigned_to
     and old.hotel is not distinct from new.hotel then
    return new;
  end if;

  body := jsonb_build_object(
    'key', case when old.statut is distinct from new.statut then 'ticket_status_changed' else 'ticket_updated' end,
    'ticket', coalesce(new.numero, new.id::text),
    'status', new.statut
  );
  for recipient in select recipient_id from public.ticket_notification_recipient_ids(new.id)
  loop
    perform public.onomo_notify(recipient, new.id, 'updated', body);
  end loop;
  return new;
end;
$$;

create or replace function public.onomo_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  ticket_number text;
begin
  select coalesce(numero, id::text) into ticket_number
  from public.tickets where id = new.ticket_id;
  if ticket_number is null then return new; end if;

  for recipient in select recipient_id from public.ticket_notification_recipient_ids(new.ticket_id)
  loop
    perform public.onomo_notify(recipient, new.ticket_id, 'comment',
      jsonb_build_object('key', 'ticket_comment_added', 'ticket', ticket_number));
  end loop;
  return new;
end;
$$;

create or replace function public.onomo_attachment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  ticket_number text;
begin
  select coalesce(numero, id::text) into ticket_number
  from public.tickets where id = new.ticket_id;
  if ticket_number is null then return new; end if;

  for recipient in select recipient_id from public.ticket_notification_recipient_ids(new.ticket_id)
  loop
    perform public.onomo_notify(recipient, new.ticket_id, 'attachment',
      jsonb_build_object('key', 'ticket_attachment_added', 'ticket', ticket_number, 'file_name', new.file_name));
  end loop;
  return new;
end;
$$;

drop trigger if exists onomo_ticket_notifications_trigger on public.tickets;
create trigger onomo_ticket_notifications_trigger
after insert or update on public.tickets
for each row execute function public.onomo_ticket_notifications();

drop trigger if exists onomo_comment_notifications_trigger on public.commentaires;
create trigger onomo_comment_notifications_trigger
after insert on public.commentaires
for each row execute function public.onomo_comment_notifications();

drop trigger if exists onomo_attachment_notifications_trigger on public.ticket_attachments;
create trigger onomo_attachment_notifications_trigger
after insert on public.ticket_attachments
for each row execute function public.onomo_attachment_notifications();

revoke all on function public.onomo_ticket_notifications() from public, anon, authenticated;
revoke all on function public.onomo_comment_notifications() from public, anon, authenticated;
revoke all on function public.onomo_attachment_notifications() from public, anon, authenticated;

commit;
