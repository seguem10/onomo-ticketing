-- ONOMO Support IT — full read-only security audit (changes no data).
-- Run in the Supabase SQL Editor. Each row is a potential issue; an empty
-- result means every check passed.
--
-- Expected result (2026-11-12): a single row,
--   Règle toujours vraie | hotels | hotels_read_authenticated (SELECT)
-- which is intended: signed-in users need the hotel list for forms.

select * from (
  -- 1. Any table in public without Row Level Security.
  select 'RLS désactivé' as probleme, c.relname::text as objet, null::text as detail
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity

  union all
  -- 2. Policies that let anonymous visitors (anon / public) touch a table.
  select 'Règle ouverte aux visiteurs anonymes', tablename::text, policyname || ' (' || cmd || ')'
  from pg_policies
  where schemaname = 'public' and (roles && array['anon','public']::name[])

  union all
  -- 3. Policies whose condition is always true (USING true / WITH CHECK true).
  select 'Règle toujours vraie', tablename::text, policyname || ' (' || cmd || ')'
  from pg_policies
  where schemaname = 'public'
    and (trim(coalesce(qual,'')) = 'true' or trim(coalesce(with_check,'')) = 'true')

  union all
  -- 4. Table privileges granted to anon (RLS still applies, but should be none).
  select 'Droit accordé à anon', table_name::text, string_agg(privilege_type, ', ')
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon'
  group by table_name

  union all
  -- 5. Views in public (views bypass RLS unless security_invoker is set).
  select 'Vue sans security_invoker', c.relname::text, null
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not coalesce((select bool_or(opt in ('security_invoker=true','security_invoker=on'))
                      from unnest(c.reloptions) opt), false)

  union all
  -- 6. SECURITY DEFINER functions callable by anon.
  select 'Fonction SECURITY DEFINER appelable par anon', p.proname::text, null
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and has_function_privilege('anon', p.oid, 'execute')

  union all
  -- 7. Public storage buckets.
  select 'Bucket de stockage public', name::text, null
  from storage.buckets where public
) audit
order by probleme, objet;
