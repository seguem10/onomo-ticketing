-- ONOMO Support IT — keep one canonical notification pipeline.
-- Run after realtime_notifications.sql. It does not delete notification rows.
--
-- Older P2 triggers emit French message payloads. The canonical ONOMO triggers
-- emit i18n keys and are consumed by runtime-sync.js in the recipient's active
-- language. Having both trigger families active produces duplicate alerts.

begin;

drop trigger if exists ticket_notification_trigger on public.tickets;
drop trigger if exists ticket_comment_notification_trigger on public.commentaires;

commit;
