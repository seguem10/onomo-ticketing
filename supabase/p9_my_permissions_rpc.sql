-- ONOMO Support IT — expose only the connected user's effective permissions.
-- Run after p0_rls_hardening.sql. This supports a permission-driven frontend
-- without making app_roles or app_user_roles readable by non-admin users.

begin;

create or replace function public.my_permissions()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct permission order by permission), '{}'::text[])
  from public.app_user_roles ur
  join public.app_roles r on r.id = ur.role_id
  cross join lateral jsonb_array_elements_text(r.permissions) as permission
  where ur.user_id = auth.uid();
$$;

revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

commit;
