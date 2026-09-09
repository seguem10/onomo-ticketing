-- ONOMO Support IT: security, ticket assignment, categories and optional MFA enforcement.
create schema if not exists private;
create table if not exists public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id));

alter table public.tickets add column if not exists assigned_to uuid references auth.users(id) on delete set null;
create index if not exists tickets_assigned_to_idx on public.tickets(assigned_to);
create index if not exists tickets_created_by_idx on public.tickets(created_by);

update public.tickets t set assigned_to=u.auth_user_id from public.utilisateurs u where t.assigned_to is null and u.auth_user_id is not null and (t.assigne_a=u.auth_user_id::text or lower(t.assigne_a)=lower(u.email));
update public.tickets set categorie='Autre' where categorie not in ('IT / Réseau','Chambres','Restauration','Guest relations','Sécurité','Autre');
alter table public.tickets drop constraint if exists tickets_categorie_allowed;
alter table public.tickets add constraint tickets_categorie_allowed check (categorie in ('IT / Réseau','Chambres','Restauration','Guest relations','Sécurité','Autre'));

create or replace function public.user_has_hotel_scope(hotel_name text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.app_user_roles ur join public.app_roles r on r.id=ur.role_id where ur.user_id=(select auth.uid()) and r.name='Administrateur')
  or exists(select 1 from public.user_hotel_scopes s where s.user_id=(select auth.uid()) and s.hotel=hotel_name)
  or exists(select 1 from public.utilisateurs u where u.auth_user_id=(select auth.uid()) and (u.hotel=hotel_name or coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(hotel_name)));
$$;
create or replace function private.user_has_verified_mfa() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from auth.mfa_factors f where f.user_id=(select auth.uid()) and f.status='verified'); $$;
create or replace function private.mfa_access_ok() returns boolean language sql stable security definer set search_path='' as $$ select not (select private.user_has_verified_mfa()) or coalesce((select auth.jwt()->>'aal'),'aal1')='aal2'; $$;
create or replace function public.has_permission(permission_name text) returns boolean language sql stable security definer set search_path='' as $$ select (select private.mfa_access_ok()) and exists(select 1 from public.app_user_roles ur join public.app_roles r on r.id=ur.role_id where ur.user_id=(select auth.uid()) and (r.name='Administrateur' or r.permissions ? permission_name)); $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select (select private.mfa_access_ok()) and exists(select 1 from public.app_user_roles ur join public.app_roles r on r.id=ur.role_id where ur.user_id=(select auth.uid()) and r.name='Administrateur'); $$;

drop policy if exists allow_all on public.utilisateurs;
drop policy if exists allow_all on public.commentaires;
drop policy if exists allow_all on public.audit_logs;
drop policy if exists tickets_read on public.tickets;
drop policy if exists tickets_create on public.tickets;
drop policy if exists tickets_update on public.tickets;
drop policy if exists tickets_delete on public.tickets;
create policy tickets_read on public.tickets for select to authenticated using ((select public.is_admin()) or ((select public.has_permission('ticket:read:all')) and (select public.user_has_hotel_scope(hotel))) or ((select public.has_permission('ticket:read:own')) and created_by=(select auth.uid())) or assigned_to=(select auth.uid()));
create policy tickets_create on public.tickets for insert to authenticated with check ((select public.has_permission('ticket:create')) and created_by=(select auth.uid()) and (select public.user_has_hotel_scope(hotel)) and categorie in ('IT / Réseau','Chambres','Restauration','Guest relations','Sécurité','Autre'));
create policy tickets_update on public.tickets for update to authenticated using ((select public.is_admin()) or ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel))) or created_by=(select auth.uid()) or assigned_to=(select auth.uid())) with check ((select public.is_admin()) or ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel))) or created_by=(select auth.uid()) or assigned_to=(select auth.uid()));
create policy tickets_delete on public.tickets for delete to authenticated using ((select public.is_admin()));

drop policy if exists comments_read on public.commentaires;
drop policy if exists comments_write on public.commentaires;
create policy comments_read on public.commentaires for select to authenticated using (exists(select 1 from public.tickets t where t.id=commentaires.ticket_id));
create policy comments_write on public.commentaires for insert to authenticated with check ((select public.has_permission('comment:create')) and exists(select 1 from public.tickets t where t.id=commentaires.ticket_id));

drop policy if exists utilisateurs_read on public.utilisateurs;
drop policy if exists utilisateurs_insert on public.utilisateurs;
drop policy if exists utilisateurs_update on public.utilisateurs;
drop policy if exists utilisateurs_delete on public.utilisateurs;
create policy utilisateurs_read on public.utilisateurs for select to authenticated using (auth_user_id=(select auth.uid()) or (select public.is_admin()));
create policy utilisateurs_insert on public.utilisateurs for insert to authenticated with check ((select public.is_admin()));
create policy utilisateurs_update on public.utilisateurs for update to authenticated using (auth_user_id=(select auth.uid()) or (select public.is_admin())) with check (auth_user_id=(select auth.uid()) or (select public.is_admin()));
create policy utilisateurs_delete on public.utilisateurs for delete to authenticated using ((select public.is_admin()));

drop policy if exists app_roles_admin_all on public.app_roles;
drop policy if exists app_user_roles_admin_all on public.app_user_roles;
create policy app_roles_admin_all on public.app_roles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy app_user_roles_admin_all on public.app_user_roles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs for select to authenticated using ((select public.is_admin()));
alter table public.app_settings enable row level security;
drop policy if exists settings_admin_only on public.app_settings;
create policy settings_admin_only on public.app_settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.tickets, public.utilisateurs, public.app_roles, public.app_user_roles, public.audit_logs, public.app_settings from anon;
grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert, update, delete on public.utilisateurs to authenticated;
grant select, insert, update, delete on public.app_roles, public.app_user_roles to authenticated;
grant select on public.audit_logs, public.app_settings to authenticated;
