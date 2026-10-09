begin;

/* The support directory is a deliberate SECURITY DEFINER escape hatch from
   the self/admin-only utilisateurs policy.  Require the same verified MFA
   assurance used by ticket and permission functions before it returns any
   staff directory data. */
create or replace function public.get_support_directory()
returns table(
  id uuid,
  auth_user_id uuid,
  email text,
  prenom text,
  nom text,
  role text,
  roles jsonb,
  hotel text,
  hotels jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if not (select private.mfa_access_ok()) then
    raise exception 'MFA verification required';
  end if;

  if not (
    (select public.is_admin())
    or exists (
      select 1
      from public.app_user_roles ur
      join public.app_roles r on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and r.name in ('IT Hotel', 'IT Regional', 'Administrateur')
    )
  ) then
    raise exception 'Support directory access denied';
  end if;

  return query
  select u.id, u.auth_user_id, u.email, u.prenom, u.nom, u.role,
    coalesce(u.roles, '[]'::jsonb), u.hotel,
    coalesce(u.hotels, '[]'::jsonb), u.created_at
  from public.utilisateurs u
  where u.auth_user_id is not null
    and (
      lower(coalesce(u.role, '')) in ('admin', 'administrateur', 'it_regional', 'it regional', 'it_hotel', 'it hotel')
      or coalesce(u.roles, '[]'::jsonb) ?| array['Administrateur', 'IT Regional', 'IT Hotel', 'admin', 'it_regional', 'it_hotel']
    )
  order by lower(coalesce(u.nom, '')), lower(coalesce(u.prenom, '')), lower(u.email);
end;
$$;

revoke all on function public.get_support_directory() from public, anon;
grant execute on function public.get_support_directory() to authenticated;

commit;
