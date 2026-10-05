-- ONOMO Support IT — close legacy RLS policies that were broader than the
-- application requires.  This migration changes access rules only; it never
-- modifies ticket, profile or hotel data.

begin;

-- Hotels are a shared reference list.  All connected users may read it to
-- create a ticket, while only administrators may maintain it.
alter table public.hotels enable row level security;
drop policy if exists allow_all on public.hotels;
drop policy if exists hotels_read_authenticated on public.hotels;
drop policy if exists hotels_admin_manage on public.hotels;
create policy hotels_read_authenticated
  on public.hotels for select to authenticated
  using (true);
create policy hotels_admin_manage
  on public.hotels for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
revoke all on public.hotels from anon;
grant select, insert, update, delete on public.hotels to authenticated;

-- The legacy profiles table is not used as the application authorization
-- source (public.utilisateurs is), but it can contain personal information.
-- A user may only read their own record; administrators retain management.
alter table public.profiles enable row level security;
drop policy if exists "all" on public.profiles;
drop policy if exists profiles_read_own_or_admin on public.profiles;
drop policy if exists profiles_admin_manage on public.profiles;
create policy profiles_read_own_or_admin
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_admin_manage
  on public.profiles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

-- Keep one policy per access path for explicit hotel scopes.  The prior two
-- administrator policies were permissive duplicates and made review harder.
alter table public.user_hotel_scopes enable row level security;
drop policy if exists user_hotel_scopes_admin_all on public.user_hotel_scopes;
drop policy if exists user_hotel_scopes_admin_manage on public.user_hotel_scopes;
drop policy if exists user_hotel_scopes_self_read on public.user_hotel_scopes;
create policy user_hotel_scopes_self_read
  on public.user_hotel_scopes for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_hotel_scopes_admin_manage
  on public.user_hotel_scopes for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
revoke all on public.user_hotel_scopes from anon;
grant select, insert, update, delete on public.user_hotel_scopes to authenticated;

-- A single SELECT policy covers both approved procedures in hotel scope and
-- complete procedure access for administrators.  Write operations remain
-- administrator-only and are split by operation to avoid permissive overlap.
drop policy if exists it_procedures_admin_manage on public.it_procedures;
drop policy if exists it_procedures_read_published_or_review on public.it_procedures;
drop policy if exists it_procedures_read_scoped on public.it_procedures;
drop policy if exists it_procedures_admin_insert on public.it_procedures;
drop policy if exists it_procedures_admin_update on public.it_procedures;
drop policy if exists it_procedures_admin_delete on public.it_procedures;
create policy it_procedures_read_scoped
  on public.it_procedures for select to authenticated
  using (
    (select public.is_admin())
    or (
      (approval_status in ('approved','review') or is_validated)
      and (hotel is null or (select public.user_has_hotel_scope(hotel)))
    )
  );
create policy it_procedures_admin_insert
  on public.it_procedures for insert to authenticated
  with check ((select public.is_admin()));
create policy it_procedures_admin_update
  on public.it_procedures for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy it_procedures_admin_delete
  on public.it_procedures for delete to authenticated
  using ((select public.is_admin()));

commit;
