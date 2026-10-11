begin;
create table public.access_requests (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null,
 hotel text not null,
 system_name text not null check(system_name in ('OPERA','Microsoft 365')),
 subject text not null check(length(subject) between 3 and 160),
 description text not null check(length(description) between 10 and 4000),
 stage text not null default 'it' check(stage in ('it','director','hr','approved','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index access_requests_requester_created on public.access_requests(requester_id,created_at desc);
create index access_requests_hotel_stage on public.access_requests(hotel,stage);
create table public.access_request_decisions (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.access_requests(id),
 actor_id uuid not null,
 step text not null check(step in ('it','director','hr')),
 decision text not null check(decision in ('approve','reject')),
 reason text not null check(length(reason) between 3 and 2000),
 created_at timestamptz not null default now(),
 unique(request_id,step)
);
create index access_request_decisions_actor on public.access_request_decisions(actor_id);
alter table public.access_requests enable row level security;
alter table public.access_request_decisions enable row level security;
revoke all on public.access_requests,public.access_request_decisions from public,anon,authenticated;
grant select on public.access_requests,public.access_request_decisions to authenticated;

-- Restricted helpers live outside the exposed API schema. Identity, live
-- session, first-login gate and MFA are checked even in privileged functions.
create function private.access_workflow_session_ok() returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
 and exists(select 1 from auth.sessions s where s.user_id=(select auth.uid())
   and s.id::text=(select auth.jwt()->>'session_id')
   and (s.not_after is null or s.not_after>now()))
 and exists(select 1 from auth.users a where a.id=(select auth.uid())
   and (a.banned_until is null or a.banned_until<now()))
 and exists(select 1 from public.utilisateurs u where u.auth_user_id=(select auth.uid())
   and u.must_change_password is false)
 and (select private.mfa_access_ok());
$$;
create function private.access_workflow_can_approve(hotel_name text,approval_step text) returns boolean
language sql stable security definer set search_path='' as $$
 select (select private.access_workflow_session_ok()) and exists(
 select 1 from public.utilisateurs u
 join public.app_user_roles ur on ur.user_id=u.auth_user_id
 join public.app_roles r on r.id=ur.role_id
 where u.auth_user_id=(select auth.uid()) and (
  (approval_step='it' and r.name='IT Hotel' and u.hotel=hotel_name)
  or (approval_step='it' and r.name='IT Regional' and coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(hotel_name))
  or (approval_step='director' and r.name='Directeur Hôtel' and u.hotel=hotel_name)
  or (approval_step='hr' and r.name='RH Régional' and coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(hotel_name))
 ));
$$;
create function private.access_workflow_can_read(owner_id uuid,hotel_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select (select private.access_workflow_session_ok()) and (
 owner_id=(select auth.uid()) or (select public.is_admin())
 or private.access_workflow_can_approve(hotel_name,'it')
 or private.access_workflow_can_approve(hotel_name,'director')
 or private.access_workflow_can_approve(hotel_name,'hr'));
$$;
revoke all on function private.access_workflow_session_ok(),private.access_workflow_can_approve(text,text),private.access_workflow_can_read(uuid,text) from public,anon,authenticated;
grant execute on function private.access_workflow_session_ok(),private.access_workflow_can_approve(text,text),private.access_workflow_can_read(uuid,text) to authenticated;
create policy access_requests_scoped_read on public.access_requests for select to authenticated
 using(private.access_workflow_can_read(requester_id,hotel));
create policy access_decisions_scoped_read on public.access_request_decisions for select to authenticated
 using(exists(select 1 from public.access_requests r where r.id=request_id));

create function private.submit_access_request(hotel_name text,target_system text,title text,details text) returns uuid
language plpgsql security definer set search_path='' as $$
declare request_id uuid;
begin
 if not private.access_workflow_session_ok() then raise exception 'Session valide et première connexion terminée requises' using errcode='42501'; end if;
 if not public.user_has_hotel_scope(hotel_name)
 or not exists(select 1 from public.hotels h where h.nom=hotel_name) then
  raise exception 'Hôtel hors périmètre' using errcode='42501';
 end if;
 insert into public.access_requests(requester_id,hotel,system_name,subject,description)
 values(auth.uid(),hotel_name,target_system,btrim(title),btrim(details)) returning id into request_id;
 return request_id;
end;
$$;
create function private.decide_access_request(target_id uuid,expected_step text,answer text,explanation text) returns text
language plpgsql security definer set search_path='' as $$
declare request_row public.access_requests%rowtype; next_stage text;
begin
 if not private.access_workflow_session_ok() or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
  raise exception 'Session MFA requise pour valider' using errcode='42501';
 end if;
 select * into request_row from public.access_requests where id=target_id for update;
 if not found or not private.access_workflow_can_read(request_row.requester_id,request_row.hotel) then
  raise exception 'Demande inaccessible' using errcode='42501';
 end if;
 if request_row.requester_id=auth.uid() then raise exception 'Auto-approbation interdite' using errcode='42501'; end if;
 if expected_step is null or request_row.stage<>expected_step or request_row.stage not in ('it','director','hr') then
  raise exception 'Étape terminée ou modifiée. Actualisez la demande.' using errcode='40001';
 end if;
 if not private.access_workflow_can_approve(request_row.hotel,request_row.stage) then
  raise exception 'Rôle ou hôtel non autorisé pour cette étape' using errcode='42501';
 end if;
 if answer is null or answer not in ('approve','reject') or explanation is null or length(btrim(explanation)) not between 3 and 2000 then
  raise exception 'Décision et justification valides requises' using errcode='22023';
 end if;
 next_stage:=case when answer='reject' then 'rejected'
  when request_row.stage='it' then 'director' when request_row.stage='director' then 'hr' else 'approved' end;
 insert into public.access_request_decisions(request_id,actor_id,step,decision,reason)
 values(target_id,auth.uid(),request_row.stage,answer,btrim(explanation));
 update public.access_requests set stage=next_stage,updated_at=now() where id=target_id;
 return next_stage;
end;
$$;
revoke all on function private.submit_access_request(text,text,text,text),private.decide_access_request(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.submit_access_request(text,text,text,text),private.decide_access_request(uuid,text,text,text) to authenticated;
-- Thin invoker wrappers expose only the explicitly authorized entry points.
create function public.submit_access_request(hotel_name text,target_system text,title text,details text) returns uuid
language sql security invoker set search_path='' begin atomic select private.submit_access_request(hotel_name,target_system,title,details); end;
create function public.decide_access_request(target_id uuid,expected_step text,answer text,explanation text) returns text
language sql security invoker set search_path='' begin atomic select private.decide_access_request(target_id,expected_step,answer,explanation); end;
revoke all on function public.submit_access_request(text,text,text,text),public.decide_access_request(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_access_request(text,text,text,text),public.decide_access_request(uuid,text,text,text) to authenticated;
commit;
