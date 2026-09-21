-- Run after ticketing_production_migration.sql.
-- Produces only recipient-specific notification rows; RLS on notifications
-- remains responsible for ensuring that a user can read/update only their own.
alter table public.notifications replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

create or replace function public.onomo_notify(recipient uuid, target_ticket uuid, notification_type text, notification_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if recipient is not null and recipient is distinct from auth.uid() then
    insert into public.notifications(recipient_id, ticket_id, type, body)
    values (recipient, target_ticket, notification_type, notification_body);
  end if;
end;
$$;

create or replace function public.onomo_ticket_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_user uuid;
begin
  if new.assigne_a is not null and btrim(new.assigne_a) <> '' then
    select auth_user_id into assigned_user
    from public.utilisateurs
    where lower(btrim(concat_ws(' ', prenom, nom))) = lower(btrim(new.assigne_a))
      and auth_user_id is not null
    limit 1;
  end if;

  if tg_op = 'INSERT' then
    perform public.onomo_notify(assigned_user, new.id, 'assignment', jsonb_build_object('key','ticket_assigned','ticket',coalesce(new.numero, new.id::text)));
    return new;
  end if;

  if old.assigne_a is distinct from new.assigne_a then
    perform public.onomo_notify(assigned_user, new.id, 'assignment', jsonb_build_object('key','ticket_reassigned','ticket',coalesce(new.numero, new.id::text)));
  end if;
  if old.statut is distinct from new.statut then
    perform public.onomo_notify(new.created_by, new.id, 'status', jsonb_build_object('key','ticket_status_changed','ticket',coalesce(new.numero, new.id::text),'status',new.statut));
  end if;
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
  ticket_row public.tickets%rowtype;
  assigned_user uuid;
begin
  select * into ticket_row from public.tickets where id = new.ticket_id;
  if not found then return new; end if;
  if ticket_row.assigne_a is not null and btrim(ticket_row.assigne_a) <> '' then
    select auth_user_id into assigned_user
    from public.utilisateurs
    where lower(btrim(concat_ws(' ', prenom, nom))) = lower(btrim(ticket_row.assigne_a))
      and auth_user_id is not null
    limit 1;
  end if;
  perform public.onomo_notify(ticket_row.created_by, ticket_row.id, 'comment', jsonb_build_object('key','ticket_comment_added','ticket',coalesce(ticket_row.numero, ticket_row.id::text)));
  perform public.onomo_notify(assigned_user, ticket_row.id, 'comment', jsonb_build_object('key','ticket_comment_added','ticket',coalesce(ticket_row.numero, ticket_row.id::text)));
  return new;
end;
$$;

drop trigger if exists onomo_ticket_notifications_trigger on public.tickets;
create trigger onomo_ticket_notifications_trigger
after insert or update of assigne_a, statut on public.tickets
for each row execute function public.onomo_ticket_notifications();

drop trigger if exists onomo_comment_notifications_trigger on public.commentaires;
create trigger onomo_comment_notifications_trigger
after insert on public.commentaires
for each row execute function public.onomo_comment_notifications();

revoke all on function public.onomo_notify(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.onomo_ticket_notifications() from public, anon, authenticated;
revoke all on function public.onomo_comment_notifications() from public, anon, authenticated;
