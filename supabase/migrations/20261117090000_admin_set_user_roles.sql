-- Editing an account changed only public.utilisateurs. Effective permissions
-- (is_admin, has_permission) come from public.app_user_roles, which kept the
-- old roles, and the "additional roles" boxes were ignored.
-- admin_set_user_roles replaces a profile's roles in both tables atomically.
-- Administrators only; an administrator cannot remove their own
-- Administrateur role. Idempotent.
create or replace function public.admin_set_user_roles(target_profile text, role_names text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_auth uuid;
  names text[];
  wanted uuid[];
  unknown text;
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier les rôles' using errcode = '42501';
  end if;

  select u.auth_user_id into target_auth from public.utilisateurs u where u.id = target_profile;
  if target_auth is null then
    raise exception 'Compte Supabase introuvable pour ce profil' using errcode = 'P0002';
  end if;

  select array_agg(distinct btrim(n)) into names
  from unnest(coalesce(role_names, '{}'::text[])) n
  where btrim(coalesce(n, '')) <> '';
  if names is null then
    raise exception 'Au moins un rôle est requis' using errcode = '22023';
  end if;

  select n into unknown from unnest(names) n
  where not exists (select 1 from public.app_roles r where r.name = n) limit 1;
  if unknown is not null then
    raise exception 'Rôle inconnu : %', unknown using errcode = '22023';
  end if;

  if target_auth = auth.uid() and not ('Administrateur' = any(names)) then
    raise exception 'Vous ne pouvez pas retirer votre propre rôle Administrateur' using errcode = '42501';
  end if;

  select array_agg(r.id) into wanted from public.app_roles r where r.name = any(names);

  delete from public.app_user_roles where user_id = target_auth and role_id <> all(wanted);
  insert into public.app_user_roles(user_id, role_id)
  select target_auth, unnest(wanted)
  on conflict (user_id, role_id) do nothing;

  update public.utilisateurs set roles = to_jsonb(names) where id = target_profile;

  insert into public.audit_logs(id, "user", action, detail, "timestamp")
  values (gen_random_uuid()::text, auth.uid()::text, 'user_roles_updated',
          jsonb_build_object('target', target_auth, 'roles', names)::text, now());

  return to_jsonb(names);
end;
$$;

revoke all on function public.admin_set_user_roles(text, text[]) from public, anon;
grant execute on function public.admin_set_user_roles(text, text[]) to authenticated;
