-- ONOMO Support IT — immutable attachment audit events.
-- Apply after p16_ticket_attachments.sql and p15_audit_log_immutability.sql.
-- No private storage path is copied into either history table.

begin;

create or replace function public.audit_ticket_attachment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_action text;
  attachment_id text;
  related_ticket uuid;
  event_data jsonb;
begin
  if tg_op = 'INSERT' then
    event_action := 'attachment_added';
    attachment_id := new.id::text;
    related_ticket := new.ticket_id;
    event_data := jsonb_build_object(
      'attachment_id', new.id,
      'file_name', new.file_name,
      'content_type', new.content_type,
      'file_size', new.file_size
    );
  else
    event_action := 'attachment_deleted';
    attachment_id := old.id::text;
    related_ticket := old.ticket_id;
    event_data := jsonb_build_object(
      'attachment_id', old.id,
      'file_name', old.file_name,
      'content_type', old.content_type,
      'file_size', old.file_size
    );
  end if;

  insert into public.ticket_events(ticket_id, actor_id, action, new_values)
  values (related_ticket, auth.uid(), event_action, event_data);

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), event_action, 'ticket_attachment', attachment_id,
    event_data || jsonb_build_object('ticket_id', related_ticket));

  return coalesce(new, old);
end;
$$;

drop trigger if exists onomo_audit_ticket_attachment_change on public.ticket_attachments;
create trigger onomo_audit_ticket_attachment_change
  after insert or delete on public.ticket_attachments
  for each row execute function public.audit_ticket_attachment_change();

revoke all on function public.audit_ticket_attachment_change() from public, anon, authenticated;

commit;
