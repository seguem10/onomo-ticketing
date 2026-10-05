-- ONOMO Support IT — least privilege for PostgreSQL SECURITY DEFINER functions.
--
-- SECURITY DEFINER functions bypass ordinary table permissions.  They must
-- never be callable through Supabase's anonymous role unless they are
-- explicitly designed as a public endpoint.  This project has no such RPC.
-- Keep the browser-facing RPC allow-list deliberately small and authenticated.

begin;

-- Remove the PostgreSQL default EXECUTE privilege from every existing
-- SECURITY DEFINER function in application schemas.  Trigger functions and
-- internal helpers do not need a browser caller at all.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
  loop
    execute format('revoke all on function %s from public, anon, authenticated', fn.signature);
  end loop;
end;
$$;

-- Explicit allow-list: authenticated web users only.  These functions either
-- return the caller's own authorization data or enforce authorization inside
-- the function before returning anything.
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.user_has_hotel_scope(text) to authenticated;
grant execute on function public.requester_available_it() to authenticated;
grant execute on function public.requester_it_users() to authenticated;
grant execute on function public.get_support_directory() to authenticated;
grant execute on function public.replace_user_roles(uuid, text[]) to authenticated;

-- The notification Edge Function is the sole server-side consumer of this
-- recipient resolver.  It uses the service role, never a browser session.
grant execute on function public.ticket_notification_recipient_ids(uuid) to service_role;

-- New functions are private by default.  Every future RPC needs an explicit
-- grant in its own migration, preventing accidental exposure after deployment.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema private
  revoke execute on functions from public;

commit;
