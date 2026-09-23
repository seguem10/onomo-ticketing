-- ONOMO Support IT — RBAC policy and permission reconciliation.
-- Run after p12_ticket_related_rls_reconciliation.sql.
--
-- Only Administrateurs may inspect or change role definitions and role
-- memberships. Other users receive their own effective permissions through
-- my_permissions(), never through a broad select on these tables.

begin;

alter table public.app_roles enable row level security;
alter table public.app_user_roles enable row level security;

do $$
declare
  table_name text;
  existing_policy text;
begin
  foreach table_name in array array['app_roles', 'app_user_roles']
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

-- Keep the wildcard semantic consistent for system and custom roles. MFA AAL
-- is still enforced by private.mfa_access_ok() when an account enrolled MFA.
create or replace function public.has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.mfa_access_ok()) and exists (
    select 1
    from public.app_user_roles user_role
    join public.app_roles role on role.id = user_role.role_id
    where user_role.user_id = (select auth.uid())
      and (
        role.name = 'Administrateur'
        or role.permissions ? '*'
        or role.permissions ? permission_name
      )
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.mfa_access_ok()) and exists (
    select 1
    from public.app_user_roles user_role
    join public.app_roles role on role.id = user_role.role_id
    where user_role.user_id = (select auth.uid())
      and role.name = 'Administrateur'
  );
$$;

create policy app_roles_admin_manage
  on public.app_roles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy app_user_roles_admin_manage
  on public.app_user_roles for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct permission order by permission), '{}'::text[])
  from public.app_user_roles user_role
  join public.app_roles role on role.id = user_role.role_id
  cross join lateral jsonb_array_elements_text(role.permissions) as permission
  where user_role.user_id = (select auth.uid());
$$;

revoke all on table public.app_roles, public.app_user_roles from anon;
grant select, insert, update, delete on table public.app_roles, public.app_user_roles to authenticated;
revoke all on function public.has_permission(text), public.is_admin(), public.my_permissions() from public, anon;
grant execute on function public.has_permission(text), public.is_admin(), public.my_permissions() to authenticated;

commit;
