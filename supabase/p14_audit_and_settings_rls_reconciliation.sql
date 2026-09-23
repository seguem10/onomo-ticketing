-- ONOMO Support IT — audit log and system settings reconciliation.
-- Run after p13_rbac_reconciliation.sql.
--
-- Audit entries are generated server-side only. System settings are fully
-- administrator-only and their attribution cannot be spoofed by a client.

begin;

alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

do $$
declare
  table_name text;
  existing_policy text;
begin
  foreach table_name in array array['audit_logs', 'app_settings']
  loop
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', existing_policy, table_name);
    end loop;
  end loop;
end;
$$;

create policy audit_logs_admin_read
  on public.audit_logs for select to authenticated
  using ((select public.is_admin()));

create policy app_settings_admin_manage
  on public.app_settings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create or replace function public.stamp_app_setting_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists onomo_stamp_app_setting_change on public.app_settings;
create trigger onomo_stamp_app_setting_change
  before insert or update on public.app_settings
  for each row execute function public.stamp_app_setting_change();

-- Metadata-only audit trigger from p3 remains the canonical event writer.
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
    auth.uid(), event_action, 'app_setting', changed_key,
    jsonb_build_object('operation', tg_op, 'setting_key', changed_key)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists onomo_audit_app_setting_change on public.app_settings;
create trigger onomo_audit_app_setting_change
  after insert or update or delete on public.app_settings
  for each row execute function public.audit_app_setting_change();

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
revoke all on public.app_settings from anon;
grant select, insert, update, delete on public.app_settings to authenticated;
revoke all on function public.stamp_app_setting_change(), public.audit_app_setting_change() from public, anon, authenticated;

commit;
