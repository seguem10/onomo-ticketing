-- REVIEW REQUIRED: rollback restores the known residual-assignment risk.
-- Apply only with explicit operational approval, never automatically.
begin;
alter policy tickets_read on public.tickets using ((select public.is_admin()) or ((select public.has_permission('ticket:read:all')) and (select public.user_has_hotel_scope(tickets.hotel))) or ((select public.has_permission('ticket:read:own')) and created_by=(select auth.uid())) or assigned_to=(select auth.uid()));
alter policy tickets_update on public.tickets using ((select public.is_admin()) or ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(tickets.hotel))) or created_by=(select auth.uid()) or assigned_to=(select auth.uid())) with check ((select public.is_admin()) or ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(tickets.hotel))) or created_by=(select auth.uid()) or assigned_to=(select auth.uid()));
commit;
