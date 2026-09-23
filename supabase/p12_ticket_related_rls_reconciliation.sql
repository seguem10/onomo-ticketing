-- ONOMO Support IT — comments, history and notification RLS reconciliation.
-- Run after p11_ticket_rls_reconciliation.sql.
--
-- Related records must never be more visible than their parent ticket.
-- This removes legacy permissive policies and grants only the database rights
-- actually required by the browser; database triggers keep writing history and
-- notifications through their SECURITY DEFINER functions.

begin;

alter table public.commentaires enable row level security;
alter table public.ticket_events enable row level security;
alter table public.notifications enable row level security;

do $$
declare
  table_name text;
  existing_policy text;
begin
  foreach table_name in array array['commentaires', 'ticket_events', 'notifications']
  loop
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', existing_policy, table_name);
    end loop;
  end loop;
end;
$$;

-- A comment is visible only if its ticket is visible under tickets RLS.
create policy comments_read
  on public.commentaires for select to authenticated
  using (
    exists (
      select 1 from public.tickets ticket
      where ticket.id = commentaires.ticket_id
    )
  );

-- Requesters and IT may add a comment only where they can already read the
-- ticket. No client-side update/delete of comments is permitted.
create policy comments_write
  on public.commentaires for insert to authenticated
  with check (
    (select public.has_permission('comment:create'))
    and exists (
      select 1 from public.tickets ticket
      where ticket.id = commentaires.ticket_id
    )
  );

-- The immutable audit trail inherits the parent ticket's RLS decision.
create policy ticket_events_read
  on public.ticket_events for select to authenticated
  using (
    exists (
      select 1 from public.tickets ticket
      where ticket.id = ticket_events.ticket_id
    )
  );

-- Notifications are private to their recipient. A recipient may only mark
-- their own notification as read; they cannot create, delete or retarget it.
create policy notifications_read_own
  on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy notifications_mark_read_own
  on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

revoke all on public.commentaires, public.ticket_events, public.notifications from anon;
revoke all on public.commentaires, public.ticket_events, public.notifications from authenticated;
grant select, insert on public.commentaires to authenticated;
grant select on public.ticket_events to authenticated;
grant select, update on public.notifications to authenticated;

commit;
