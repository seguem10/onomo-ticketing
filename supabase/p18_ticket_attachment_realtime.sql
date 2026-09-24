-- ONOMO Support IT — publish secure attachment/history events to Realtime.
-- Apply after p16_ticket_attachments.sql and p17_ticket_attachment_audit.sql.

begin;

alter table public.ticket_attachments replica identity full;
alter table public.ticket_events replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.ticket_attachments;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ticket_events;
exception when duplicate_object then null;
end $$;

commit;
