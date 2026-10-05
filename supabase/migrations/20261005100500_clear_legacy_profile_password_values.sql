-- One-time hygiene migration for databases that existed before Supabase Auth
-- became the sole password authority.  The value is not a Supabase Auth
-- credential and is intentionally discarded.
begin;

update public.utilisateurs
set pwd = ''
where nullif(btrim(coalesce(pwd, '')), '') is not null;

commit;
