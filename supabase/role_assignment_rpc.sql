-- Run after p0_audit_remediation.sql.
-- Atomic server-side replacement of a user's RBAC links. The browser never
-- receives a privileged key and cannot assign roles unless public.is_admin()
-- approves the caller from their authenticated Supabase session.
create or replace function public.replace_user_roles(target_user_id uuid, role_names text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_count integer;
  first_role text;
begin
  if not public.is_admin() then
    raise exception 'Access denied';
  end if;
  if target_user_id is null or coalesce(array_length(role_names, 1), 0) = 0 then
    raise exception 'At least one role is required';
  end if;
  if exists (select 1 from unnest(role_names) as value where btrim(value) = '') then
    raise exception 'Invalid role name';
  end if;

  select count(*) into selected_count
  from public.app_roles
  where name = any(role_names);
  if selected_count <> cardinality(role_names) then
    raise exception 'Unknown role';
  end if;

  delete from public.app_user_roles where user_id = target_user_id;
  insert into public.app_user_roles(user_id, role_id)
  select target_user_id, id from public.app_roles where name = any(role_names);

  first_role := role_names[1];
  update public.utilisateurs
  set roles = to_jsonb(role_names),
      role = case first_role
        when 'Administrateur' then 'admin'
        when 'IT Regional' then 'it_regional'
        when 'IT Hotel' then 'it_hotel'
        when 'Directeur' then 'direction'
        when 'Demandeur' then 'demandeur'
        else first_role
      end
  where auth_user_id = target_user_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'user_roles_replaced', 'user', target_user_id::text, jsonb_build_object('roles', role_names));
end;
$$;

revoke all on function public.replace_user_roles(uuid, text[]) from public, anon;
grant execute on function public.replace_user_roles(uuid, text[]) to authenticated;
