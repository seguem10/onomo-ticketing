-- ONOMO Support IT — compatibility repair for legacy audit_logs installations.
--
-- Some existing deployments retain the original audit_logs schema:
--   id, action, user, detail, timestamp, ip, ua, device
-- rather than the newer actor_id/entity_type/entity_id/metadata schema.
-- The attachment trigger must never make a valid attachment upload fail merely
-- because audit logging uses that legacy schema.

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

  -- Keep the trigger compatible with the audit_logs table that is currently
  -- deployed. Do not store the private storage path in the audit event.
  insert into public.audit_logs(id, action, "user", detail)
  values (
    gen_random_uuid()::text,
    event_action,
    coalesce(auth.uid()::text, 'system'),
    (event_data || jsonb_build_object('ticket_id', related_ticket))::text
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.audit_ticket_attachment_change() from public, anon, authenticated;

commit;
