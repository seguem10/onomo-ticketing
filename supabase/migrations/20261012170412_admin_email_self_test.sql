begin;
create or replace function public.claim_admin_email_self_test(actor uuid)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text,73191));
 if exists(select 1 from public.audit_logs where actor_id=actor and action='email_self_test_attempt' and created_at>now()-interval '60 seconds') then return false; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
 values(actor,'email_self_test_attempt','user',actor,'{}'::jsonb);
 return true;
end;
$$;
revoke all on function public.claim_admin_email_self_test(uuid) from public,anon,authenticated;
grant execute on function public.claim_admin_email_self_test(uuid) to service_role;
commit;
