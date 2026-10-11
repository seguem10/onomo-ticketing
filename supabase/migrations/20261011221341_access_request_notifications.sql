begin;
create table public.access_request_notifications (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.access_requests(id),
 recipient_id uuid not null,
 event_stage text not null check(event_stage in ('it','director','hr','approved','rejected')),
 created_at timestamptz not null default now(),
 read_at timestamptz,
 unique(request_id,recipient_id,event_stage)
);
create index access_notifications_inbox on public.access_request_notifications(recipient_id,created_at desc);
alter table public.access_request_notifications enable row level security;
revoke all on public.access_request_notifications from public,anon,authenticated;
grant select on public.access_request_notifications to authenticated;
grant update(read_at) on public.access_request_notifications to authenticated;
create policy access_notification_own_read on public.access_request_notifications for select to authenticated
using(recipient_id=(select auth.uid()) and (select private.access_workflow_session_ok())
 and exists(select 1 from public.access_requests r where r.id=request_id));
create policy access_notification_own_seen on public.access_request_notifications for update to authenticated
using(recipient_id=(select auth.uid()) and (select private.access_workflow_session_ok())
 and exists(select 1 from public.access_requests r where r.id=request_id))
with check(recipient_id=(select auth.uid()) and (select private.access_workflow_session_ok())
 and exists(select 1 from public.access_requests r where r.id=request_id));

create function private.access_request_notify_stage() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.stage=old.stage then return new; end if;
 end if;
 -- Role membership and hotel scope come only from persisted server data.
 -- Administrators do not substitute for a designated approval role.
 insert into public.access_request_notifications(request_id,recipient_id,event_stage)
 select new.id,u.auth_user_id,new.stage
 from public.utilisateurs u join auth.users a on a.id=u.auth_user_id
 where (a.banned_until is null or a.banned_until<now())
 and u.auth_user_id is distinct from auth.uid()
 and (u.auth_user_id=new.requester_id or (
   u.auth_user_id<>new.requester_id and exists(
    select 1 from public.app_user_roles ur join public.app_roles r on r.id=ur.role_id
    where ur.user_id=u.auth_user_id and (
     (new.stage in ('it','approved') and r.name='IT Hotel' and u.hotel=new.hotel)
     or (new.stage in ('it','approved') and r.name='IT Regional' and coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(new.hotel))
     or (new.stage='director' and r.name='Directeur Hôtel' and u.hotel=new.hotel)
     or (new.stage='hr' and r.name='RH Régional' and coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(new.hotel))
    ))))
 on conflict(request_id,recipient_id,event_stage) do nothing;
 return new;
end;
$$;
revoke all on function private.access_request_notify_stage() from public,anon,authenticated;
create trigger access_request_stage_notification after insert or update of stage on public.access_requests
for each row execute function private.access_request_notify_stage();
commit;
