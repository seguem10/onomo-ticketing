begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Existing IT Hotel account in this project.
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"37e0b32f-32b1-42e1-9a56-71a12b885e53","aal":"aal1"}';

select lives_ok($$insert into public.tickets(numero,titre,hotel,categorie,priorite,statut,created_by,assigned_to)
  values('TEST-PGTAP-IT','RLS IT create','Airport','IT / Réseau','Normale','nouveau','37e0b32f-32b1-42e1-9a56-71a12b885e53','37e0b32f-32b1-42e1-9a56-71a12b885e53')$$,
  'IT Hotel can create a ticket in its configured hotel');

select is((select count(*)::int from public.tickets where numero='TEST-PGTAP-IT'),1,'created ticket is visible to its creator');
select is((select assigned_to::text from public.tickets where numero='TEST-PGTAP-IT'),'37e0b32f-32b1-42e1-9a56-71a12b885e53','assignment is persisted');

set local request.jwt.claims='{"role":"authenticated","sub":"8a6fa101-18fe-494c-9c05-7de37b6e27eb","aal":"aal1"}';
select is((select count(*)::int from public.tickets where numero='TEST-PGTAP-IT'),1,'administrator can read the test ticket');

select throws_ok($$insert into public.tickets(numero,titre,hotel,categorie,priorite,created_by)
  values('TEST-PGTAP-BAD','bad category','Airport','Maintenance','Normale','8a6fa101-18fe-494c-9c05-7de37b6e27eb')$$,
  '23514',null,'invalid category is rejected by database constraint');

set local request.jwt.claims='{"role":"authenticated","sub":"37e0b32f-32b1-42e1-9a56-71a12b885e53","aal":"aal1"}';
select throws_ok($$insert into public.app_settings(key,value,updated_by) values('__PGTAP__','{}','37e0b32f-32b1-42e1-9a56-71a12b885e53')$$,
  '42501',null,'IT Hotel cannot write administration settings');
select throws_ok($$insert into public.app_roles(name,permissions) values('__PGTAP__','[]')$$,
  '42501',null,'IT Hotel cannot modify roles');

select * from finish();
rollback;
