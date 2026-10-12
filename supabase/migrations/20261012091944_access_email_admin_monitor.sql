begin;
create function private.access_email_monitor(target_request uuid)
returns table(notification_id uuid,request_id uuid,recipient_id uuid,event_stage text,delivery_status text,provider_status integer,event_at timestamptz,attempt_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.access_workflow_session_ok() or not public.is_admin() then
  raise exception 'Consultation réservée à un administrateur avec une session valide' using errcode='42501';
 end if;
 return query
 select n.id,n.request_id,n.recipient_id,n.event_stage,
  case when d.status='sending' and d.started_at<now()-interval '2 minutes' then 'uncertain'
   when d.status is not null then d.status
   when n.event_stage<>r.stage then 'obsolete'
   else 'not_attempted' end,
  d.provider_status,n.created_at,d.started_at
 from public.access_request_notifications n
 join public.access_requests r on r.id=n.request_id
 left join private.access_email_deliveries d on d.notification_id=n.id
 where target_request is null or n.request_id=target_request
 order by n.created_at desc,n.id limit 100;
end; $$;
revoke all on function private.access_email_monitor(uuid) from public,anon,authenticated;
grant execute on function private.access_email_monitor(uuid) to authenticated;
create function public.access_email_monitor(target_request uuid default null)
returns table(notification_id uuid,request_id uuid,recipient_id uuid,event_stage text,delivery_status text,provider_status integer,event_at timestamptz,attempt_at timestamptz)
language sql security invoker set search_path='' begin atomic select * from private.access_email_monitor(target_request); end;
revoke all on function public.access_email_monitor(uuid) from public,anon,authenticated;
grant execute on function public.access_email_monitor(uuid) to authenticated;
commit;
