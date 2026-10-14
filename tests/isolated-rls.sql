-- LOCAL DISPOSABLE POSTGRES ONLY. Synthetic auth helpers, no real tokens/data.
-- Reproduces inspected tickets policies; not a Supabase Auth integration test.
create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.is_admin() returns boolean language sql stable as $$select current_setting('test.role',true)='admin'$$;
create function public.has_permission(p text) returns boolean language sql stable as $$select current_setting('test.role',true) in ('it_hotel','it_regional','admin') or p='ticket:read:own'$$;
create function public.user_has_hotel_scope(h text) returns boolean language sql stable as $$select public.is_admin() or h=any(string_to_array(current_setting('test.hotels',true),','))$$;
create table public.tickets(id uuid primary key,hotel text,created_by uuid,assigned_to uuid,titre text);
alter table public.tickets enable row level security;
create policy tickets_read on public.tickets for select to authenticated using (
 (select is_admin()) or ((select has_permission('ticket:read:all')) and (select user_has_hotel_scope(tickets.hotel)))
 or ((select has_permission('ticket:read:own')) and created_by=(select auth.uid())) or assigned_to=(select auth.uid()));
create policy tickets_create on public.tickets for insert to authenticated with check (
 (select has_permission('ticket:create')) and created_by=(select auth.uid()) and (select user_has_hotel_scope(tickets.hotel)));
grant usage on schema auth to authenticated;
grant select,insert on public.tickets to authenticated;
insert into public.tickets values
 ('00000000-0000-0000-0000-000000000101','FAKE-A','00000000-0000-0000-0000-000000000099',null,'A'),
 ('00000000-0000-0000-0000-000000000102','FAKE-B','00000000-0000-0000-0000-000000000099',null,'B'),
 ('00000000-0000-0000-0000-000000000103','FAKE-B','00000000-0000-0000-0000-000000000099','00000000-0000-0000-0000-000000000001','Former assigned ticket');
set role authenticated;
set test.uid='00000000-0000-0000-0000-000000000001';
set test.role='it_hotel';set test.hotels='FAKE-A';
select 'local_IT_reads_A' as test,case when exists(select 1 from tickets where id='00000000-0000-0000-0000-000000000101') then 'PASS' else 'FAIL' end as result;
select 'local_IT_cannot_read_unassigned_B' as test,case when not exists(select 1 from tickets where id='00000000-0000-0000-0000-000000000102') then 'PASS' else 'FAIL' end as result;
select 'local_IT_cannot_read_former_assigned_B_after_scope_removed' as test,case when not exists(select 1 from tickets where id='00000000-0000-0000-0000-000000000103') then 'PASS' else 'FAIL' end as result;
do $$begin
 begin insert into tickets values('00000000-0000-0000-0000-000000000104','FAKE-B',auth.uid(),null,'Denied');raise exception 'RLS accepted outside scope';
 exception when insufficient_privilege then raise notice 'PASS local_IT_cannot_create_B';end;
end$$;
set test.role='it_regional';set test.hotels='FAKE-A,FAKE-B';
select 'regional_reads_assigned_A_B' as test,case when (select count(*) from tickets)=3 then 'PASS' else 'FAIL' end as result;
set test.role='admin';set test.hotels='';
select 'admin_reads_all_synthetic_tickets' as test,case when (select count(*) from tickets)=3 then 'PASS' else 'FAIL' end as result;
