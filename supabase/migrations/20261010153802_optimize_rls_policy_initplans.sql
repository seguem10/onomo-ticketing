-- Preserve access control while evaluating stable auth helpers once per query.
-- This addresses the RLS initialization-plan performance advisor findings.
begin;

drop policy if exists activity_log_admin_select on public.activity_log;
create policy activity_log_admin_select on public.activity_log
  for select to authenticated
  using ((select public.is_admin_user()));

drop policy if exists activity_log_authenticated_insert on public.activity_log;
create policy activity_log_authenticated_insert on public.activity_log
  for insert to authenticated
  with check (actor_id = (select auth.uid()));

drop policy if exists ticket_attachments_delete on public.ticket_attachments;
create policy ticket_attachments_delete on public.ticket_attachments
  for delete to authenticated
  using (
    (uploaded_by = (select auth.uid()))
    or (select public.is_admin())
  );

drop policy if exists ticket_attachments_insert on public.ticket_attachments;
create policy ticket_attachments_insert on public.ticket_attachments
  for insert to authenticated
  with check (
    (uploaded_by = (select auth.uid()))
    and exists (
      select 1
      from public.tickets t
      where t.id = ticket_attachments.ticket_id
    )
  );

commit;
