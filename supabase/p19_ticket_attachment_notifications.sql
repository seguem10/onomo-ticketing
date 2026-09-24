-- ONOMO Support IT — attachment notifications for ticket participants.
-- Apply after p16_ticket_attachments.sql and realtime_notifications.sql.

begin;

create or replace function public.onomo_attachment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_row public.tickets%rowtype;
  assigned_user uuid;
  body jsonb;
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

  body := jsonb_build_object(
    'key', 'ticket_attachment_added',
    'ticket', coalesce(ticket_row.numero, ticket_row.id::text),
    'file_name', new.file_name
  );

  perform public.onomo_notify(ticket_row.created_by, ticket_row.id, 'attachment', body);
  if assigned_user is distinct from ticket_row.created_by then
    perform public.onomo_notify(assigned_user, ticket_row.id, 'attachment', body);
  end if;
  return new;
end;
$$;

drop trigger if exists onomo_attachment_notifications_trigger on public.ticket_attachments;
create trigger onomo_attachment_notifications_trigger
  after insert on public.ticket_attachments
  for each row execute function public.onomo_attachment_notifications();

revoke all on function public.onomo_attachment_notifications() from public, anon, authenticated;

commit;
