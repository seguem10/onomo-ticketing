-- ONOMO Support IT — settings security reconciliation.
-- Run after p0_rls_hardening.sql and fix_ticketing_security_assignment_categories_mfa.sql.
-- Safe to run repeatedly: it changes policies/grants only and never deletes
-- application settings or ticketing data.

begin;

alter table public.app_settings enable row level security;

-- RLS defines who may read or modify settings.  The SQL grants below allow an
-- authenticated Administrator through; they do not bypass this policy.
drop policy if exists settings_admin_only on public.app_settings;
create policy settings_admin_only on public.app_settings
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.app_settings from anon;
grant select, insert, update, delete on public.app_settings to authenticated;

-- Keep a concise, immutable trace of each configuration change without
-- copying potentially sensitive setting values into the audit journal.
create or replace function public.audit_app_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_key text;
  event_action text;
begin
  changed_key := coalesce(new.key, old.key);
  event_action := case tg_op
    when 'INSERT' then 'settings_created'
    when 'UPDATE' then 'settings_updated'
    when 'DELETE' then 'settings_deleted'
  end;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    event_action,
    'app_setting',
    changed_key,
    jsonb_build_object('operation', tg_op, 'setting_key', changed_key)
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists onomo_audit_app_setting_change on public.app_settings;
create trigger onomo_audit_app_setting_change
  after insert or update or delete on public.app_settings
  for each row execute function public.audit_app_setting_change();

revoke all on function public.audit_app_setting_change() from public, anon, authenticated;

commit;
