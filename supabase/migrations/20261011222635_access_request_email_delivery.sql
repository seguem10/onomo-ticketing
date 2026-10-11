begin;
create table private.access_email_deliveries (
 notification_id uuid primary key references public.access_request_notifications(id),
 status text not null check(status in ('sending','sent','failed','uncertain')),
 provider_status integer,
 started_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table private.access_email_deliveries enable row level security;
revoke all on private.access_email_deliveries from public,anon,authenticated;
create table private.access_email_rate_gate(id boolean primary key default true check(id),last_started timestamptz);
insert into private.access_email_rate_gate(id) values(true);
alter table private.access_email_rate_gate enable row level security;
revoke all on private.access_email_rate_gate from public,anon,authenticated;
create function private.claim_access_email(notification_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare previous timestamptz; inserted integer;
begin
 if exists(select 1 from private.access_email_deliveries d where d.notification_id=claim_access_email.notification_id) then return false; end if;
 -- Revalidate current stage, current role, current hotel and enabled account.
 if not exists(
  select 1 from public.access_request_notifications n
  join public.access_requests q on q.id=n.request_id and q.stage=n.event_stage
  join public.utilisateurs u on u.auth_user_id=n.recipient_id
  join auth.users a on a.id=u.auth_user_id
  where n.id=claim_access_email.notification_id and (a.banned_until is null or a.banned_until<now())
  and (u.auth_user_id=q.requester_id or exists(
   select 1 from public.app_user_roles ur join public.app_roles r on r.id=ur.role_id
   where ur.user_id=u.auth_user_id and (
    (q.stage in ('it','approved') and r.name='IT Hotel' and u.hotel=q.hotel)
    or (q.stage in ('it','approved') and r.name='IT Regional' and coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(q.hotel))
    or (q.stage='director' and r.name='Directeur Hôtel' and u.hotel=q.hotel)
    or (q.stage='hr' and r.name='RH Régional' and coalesce(u.hotels,'[]'::jsonb) @> jsonb_build_array(q.hotel)))))
 ) then return false; end if;
 select last_started into previous from private.access_email_rate_gate where id=true for update;
 if previous is not null and previous>clock_timestamp()-interval '1100 milliseconds' then return false; end if;
 insert into private.access_email_deliveries(notification_id,status) values(claim_access_email.notification_id,'sending') on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return false; end if;
 update private.access_email_rate_gate set last_started=clock_timestamp() where id=true;
 return true;
end; $$;
create function private.finish_access_email(notification_id uuid,delivery_status text,http_status integer) returns void
language sql security definer set search_path='' as $$
 update private.access_email_deliveries set status=delivery_status,provider_status=http_status,finished_at=now()
 where access_email_deliveries.notification_id=finish_access_email.notification_id
 and status='sending' and delivery_status in ('sent','failed','uncertain');
$$;
revoke all on function private.claim_access_email(uuid),private.finish_access_email(uuid,text,integer) from public,anon,authenticated;
grant execute on function private.claim_access_email(uuid),private.finish_access_email(uuid,text,integer) to service_role;
create function public.claim_access_email(notification_id uuid) returns boolean
language sql security invoker set search_path='' begin atomic select private.claim_access_email(notification_id); end;
create function public.finish_access_email(notification_id uuid,delivery_status text,http_status integer) returns void
language sql security invoker set search_path='' begin atomic select private.finish_access_email(notification_id,delivery_status,http_status); end;
revoke all on function public.claim_access_email(uuid),public.finish_access_email(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.claim_access_email(uuid),public.finish_access_email(uuid,text,integer) to service_role;
commit;
