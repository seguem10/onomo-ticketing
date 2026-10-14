-- PROPOSED ONLY: require current hotel scope for assignment-based access.
-- Ownership-based requester workflow is intentionally unchanged.
begin;
alter policy tickets_read on public.tickets using ((select public.is_admin()) or ((select public.has_permission('ticket:read:all')) and (select public.user_has_hotel_scope(tickets.hotel))) or ((select public.has_permission('ticket:read:own')) and created_by=(select auth.uid())) or (assigned_to=(select auth.uid()) and (select public.user_has_hotel_scope(tickets.hotel))));
alter policy tickets_update on public.tickets using ((select public.is_admin()) or ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(tickets.hotel))) or created_by=(select auth.uid()) or (assigned_to=(select auth.uid()) and (select public.user_has_hotel_scope(tickets.hotel)))) with check ((select public.is_admin()) or ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(tickets.hotel))) or created_by=(select auth.uid()) or (assigned_to=(select auth.uid()) and (select public.user_has_hotel_scope(tickets.hotel))));
commit;
