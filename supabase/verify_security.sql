-- ONOMO Support IT — read-only database security verification.
-- Run in Supabase SQL Editor after all migrations. It changes no data.

with required_tables(tablename) as (
  values
    ('tickets'), ('commentaires'), ('ticket_events'), ('ticket_attachments'), ('notifications'),
    ('utilisateurs'), ('app_roles'), ('app_user_roles'), ('audit_logs'),
    ('app_settings')
)
select required_tables.tablename,
       coalesce(pg_tables.rowsecurity, false) as rls_enabled,
       case when coalesce(pg_tables.rowsecurity, false) then 'PASS' else 'FAIL — RLS inactive' end as result
from required_tables
left join pg_tables
  on pg_tables.schemaname = 'public'
 and pg_tables.tablename = required_tables.tablename
order by required_tables.tablename;

with required_policies(tablename, policyname) as (
  values
    ('tickets', 'tickets_read'), ('tickets', 'tickets_create'),
    ('tickets', 'tickets_update'), ('tickets', 'tickets_delete'),
    ('commentaires', 'comments_read'), ('commentaires', 'comments_write'),
    ('ticket_events', 'ticket_events_read'),
    ('ticket_attachments', 'ticket_attachments_read'),
    ('ticket_attachments', 'ticket_attachments_insert'),
    ('ticket_attachments', 'ticket_attachments_delete'),
    ('notifications', 'notifications_read_own'),
    ('notifications', 'notifications_mark_read_own'),
    ('utilisateurs', 'utilisateurs_read'), ('utilisateurs', 'utilisateurs_insert'),
    ('utilisateurs', 'utilisateurs_update'), ('utilisateurs', 'utilisateurs_delete'),
    ('app_roles', 'app_roles_admin_manage'),
    ('app_user_roles', 'app_user_roles_admin_manage'),
    ('audit_logs', 'audit_logs_admin_read'),
    ('app_settings', 'app_settings_admin_manage')
)
select required_policies.tablename,
       required_policies.policyname,
       case when pg_policies.policyname is not null then 'PASS' else 'FAIL — policy missing' end as result
from required_policies
left join pg_policies
  on pg_policies.schemaname = 'public'
 and pg_policies.tablename = required_policies.tablename
 and pg_policies.policyname = required_policies.policyname
order by required_policies.tablename, required_policies.policyname;

with required_functions(proname) as (
  values
    ('has_permission'), ('is_admin'), ('my_permissions'),
    ('ticket_workflow'), ('guard_ticket_write_scope'),
    ('guard_profile_privilege_update'), ('requester_available_it'),
    ('prevent_audit_log_mutation'), ('audit_ticket_attachment_change'),
    ('onomo_attachment_notifications')
)
select required_functions.proname,
       case when pg_proc.proname is not null then 'PASS' else 'FAIL — function missing' end as result
from required_functions
left join pg_proc
  join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
  on pg_namespace.nspname = 'public'
 and pg_proc.proname = required_functions.proname
order by required_functions.proname;

-- Review the final policy inventory. There should be no unexpected permissive
-- policy left from an earlier schema version.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tickets', 'commentaires', 'ticket_events', 'ticket_attachments', 'notifications',
    'utilisateurs', 'app_roles', 'app_user_roles', 'audit_logs', 'app_settings'
  )
order by tablename, policyname;

-- Private storage rules and publication membership for attachment updates.
select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'ticket_attachment_objects_%'
order by policyname;

select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('ticket_attachments', 'ticket_events', 'notifications')
order by tablename;
