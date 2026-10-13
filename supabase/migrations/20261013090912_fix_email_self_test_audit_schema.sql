begin;
create or replace function public.claim_admin_email_self_test(actor uuid)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(actor::text,73191));
 if exists(select 1 from public.audit_logs where "user"=actor::text and action='email_self_test_attempt' and "timestamp">now()-interval '60 seconds') then return false; end if;
 insert into public.audit_logs(id,action,"user",detail,"timestamp")
 values(gen_random_uuid()::text,'email_self_test_attempt',actor::text,'Test email personnel administrateur',now());
 return true;
end;
$$;
revoke all on function public.claim_admin_email_self_test(uuid) from public,anon,authenticated;
grant execute on function public.claim_admin_email_self_test(uuid) to service_role;
commit;
