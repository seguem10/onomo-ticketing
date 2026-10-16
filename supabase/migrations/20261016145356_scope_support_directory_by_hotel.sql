begin;
-- Keep the existing RPC contract, but do not expose unrelated hotel scopes.
create or replace function public.get_support_directory()
returns table(id text,auth_user_id uuid,email text,prenom text,nom text,
  role text,roles jsonb,hotel text,hotels jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare actor uuid := (select auth.uid()); administrator boolean;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if not coalesce((select private.mfa_access_ok()),false) then
    raise exception 'MFA verification required';
  end if;
  administrator := coalesce((select public.is_admin()),false);
  if not administrator and not exists (
    select 1 from public.app_user_roles ur
    join public.app_roles r on r.id=ur.role_id
    where ur.user_id=actor and r.name in ('IT Hotel','IT Regional')
  ) then raise exception 'Support directory access denied'; end if;
  return query
  select u.id,u.auth_user_id,u.email,u.prenom,u.nom,u.role,
    coalesce(u.roles,'[]'::jsonb),
    case when administrator or u.hotel=any(shared.hotels) then u.hotel else null end,
    case when administrator then coalesce(u.hotels,'[]'::jsonb)
      else to_jsonb(shared.hotels) end,u.created_at
  from public.utilisateurs u
  cross join lateral (
    select coalesce(array_agg(distinct scope.hotel order by scope.hotel),'{}'::text[]) hotels
    from (
      select u.hotel as hotel
      union select jsonb_array_elements_text(case when jsonb_typeof(u.hotels)='array'
        then u.hotels else '[]'::jsonb end)
      union select s.hotel from public.user_hotel_scopes s where s.user_id=u.auth_user_id
    ) scope
    where nullif(btrim(scope.hotel),'') is not null
      and public.user_has_hotel_scope(scope.hotel)
  ) shared
  where u.auth_user_id is not null
    and (administrator or cardinality(shared.hotels)>0)
    and (lower(coalesce(u.role,'')) in
      ('admin','administrateur','it_regional','it regional','it_hotel','it hotel')
      or coalesce(u.roles,'[]'::jsonb) ?|
        array['Administrateur','IT Regional','IT Hotel','admin','it_regional','it_hotel'])
  order by lower(coalesce(u.nom,'')),lower(coalesce(u.prenom,'')),lower(u.email);
end;
$$;
revoke all on function public.get_support_directory() from public,anon;
grant execute on function public.get_support_directory() to authenticated;
commit;
