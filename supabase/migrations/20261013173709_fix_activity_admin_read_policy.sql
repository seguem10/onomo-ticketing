begin;
alter policy activity_log_admin_select on public.activity_log to authenticated using ((select public.is_admin()));
commit;
