-- ONOMO Support IT — Phase 0 audit remediation.
-- Run after the existing role, workflow and RLS migrations.
-- This migration is idempotent and does not delete business records.

begin;

-- Policies on a table without RLS are not enforced. Make role data private by
-- default and leave role administration exclusively to Administrateurs.
alter table public.app_roles enable row level security;
alter table public.app_user_roles enable row level security;

drop policy if exists app_roles_admin_all on public.app_roles;
drop policy if exists app_roles_admin_manage on public.app_roles;
drop policy if exists app_user_roles_admin_all on public.app_user_roles;
drop policy if exists app_user_roles_admin_manage on public.app_user_roles;

create policy app_roles_admin_manage on public.app_roles
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy app_user_roles_admin_manage on public.app_user_roles
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.app_roles, public.app_user_roles from anon;

-- Least privilege for the built-in roles. Hotel scope is enforced separately
-- by tickets_read/tickets_update RLS policies.
update public.app_roles set permissions='["*"]'::jsonb
  where name='Administrateur';
update public.app_roles set permissions='["ticket:create","ticket:read:all","ticket:update:all","comment:create","comment:read"]'::jsonb
  where name in ('IT Regional','IT Hotel');
update public.app_roles set permissions='["ticket:read:all","report:read"]'::jsonb
  where name='Directeur';
update public.app_roles set permissions='["ticket:create","ticket:read:own","comment:create","comment:read:own"]'::jsonb
  where name='Demandeur';

-- Keep the database category constraint aligned with the product's standard
-- categories. A normalized category table is planned for the next phase.
alter table public.tickets drop constraint if exists tickets_categorie_allowed;
alter table public.tickets add constraint tickets_categorie_allowed
  check (categorie in ('Maintenance','IT / Réseau','Chambres','Restauration','Guest relations','Sécurité','Ménage','Autre'));

commit;
