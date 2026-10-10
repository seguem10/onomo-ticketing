-- Split administrator write permissions by operation.
-- This preserves existing access while avoiding overlapping permissive SELECT
-- policies in the Supabase security advisor.
begin;

-- Hotels: every authenticated user may read; only administrators may write.
drop policy if exists hotels_admin_manage on public.hotels;
drop policy if exists hotels_admin_insert on public.hotels;
drop policy if exists hotels_admin_update on public.hotels;
drop policy if exists hotels_admin_delete on public.hotels;
create policy hotels_admin_insert on public.hotels
  for insert to authenticated
  with check ((select public.is_admin()));
create policy hotels_admin_update on public.hotels
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy hotels_admin_delete on public.hotels
  for delete to authenticated
  using ((select public.is_admin()));

-- Profiles: keep existing self-or-admin read policy; administrators write.
drop policy if exists profiles_admin_manage on public.profiles;
drop policy if exists profiles_admin_insert on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_insert on public.profiles
  for insert to authenticated
  with check ((select public.is_admin()));
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using ((select public.is_admin()));

-- Hotel scopes: keep existing self-read policy; administrators write.
drop policy if exists user_hotel_scopes_admin_manage on public.user_hotel_scopes;
drop policy if exists user_hotel_scopes_admin_insert on public.user_hotel_scopes;
drop policy if exists user_hotel_scopes_admin_update on public.user_hotel_scopes;
drop policy if exists user_hotel_scopes_admin_delete on public.user_hotel_scopes;
create policy user_hotel_scopes_admin_insert on public.user_hotel_scopes
  for insert to authenticated
  with check ((select public.is_admin()));
create policy user_hotel_scopes_admin_update on public.user_hotel_scopes
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy user_hotel_scopes_admin_delete on public.user_hotel_scopes
  for delete to authenticated
  using ((select public.is_admin()));

commit;
