-- ONOMO Support IT — immutable audit log.
-- Run after p14_audit_and_settings_rls_reconciliation.sql.
--
-- Audit events are append-only. Administrators can read them, while trusted
-- server workflows may insert new events; no actor can rewrite or erase an
-- existing historical entry through SQL/API access.

begin;

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Audit log entries are immutable';
end;
$$;

drop trigger if exists onomo_prevent_audit_log_mutation on public.audit_logs;
create trigger onomo_prevent_audit_log_mutation
  before update or delete on public.audit_logs
  for each row execute function public.prevent_audit_log_mutation();

revoke all on function public.prevent_audit_log_mutation() from public, anon, authenticated;

commit;
