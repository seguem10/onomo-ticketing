-- ONOMO Support IT — persistent, user-scoped ticket notifications.
-- Run after ticketing_production_migration.sql and p0_rls_hardening.sql.

begin;

alter table public.notifications enable row level security;
drop policy if exists notifications_own on public.notifications;
drop policy if exists notifications_read_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated
  using (recipient_id=(select auth.uid()));
create policy notifications_read_own on public.notifications for update to authenticated
  using (recipient_id=(select auth.uid())) with check (recipient_id=(select auth.uid()));

create or replace function public.enqueue_ticket_notification(
  p_recipient uuid, p_ticket_id uuid, p_type text, p_message text, p_actor uuid
) returns void language plpgsql security definer set search_path=public as $$
begin
  if p_recipient is null or p_recipient=p_actor then return; end if;
  insert into public.notifications(recipient_id,ticket_id,type,body)
  values (p_recipient,p_ticket_id,p_type,jsonb_build_object('message',p_message));
end;
$$;
revoke all on function public.enqueue_ticket_notification(uuid,uuid,text,text,uuid) from public, anon, authenticated;

create or replace function public.notify_ticket_change() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    perform public.enqueue_ticket_notification(new.assigned_to,new.id,'assignment',
      'Nouveau ticket assigné : '||coalesce(new.numero,'#' || new.id::text),auth.uid());
    return new;
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    perform public.enqueue_ticket_notification(new.assigned_to,new.id,'assignment',
      'Ticket réassigné : '||coalesce(new.numero,'#' || new.id::text),auth.uid());
  end if;
  if new.statut is distinct from old.statut then
    perform public.enqueue_ticket_notification(new.created_by,new.id,
      case when new.statut='fermé' then 'closed' else 'status' end,
      'Statut mis à jour : '||coalesce(new.numero,'#' || new.id::text),auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists ticket_notification_trigger on public.tickets;
create trigger ticket_notification_trigger
  after insert or update on public.tickets
  for each row execute function public.notify_ticket_change();

create or replace function public.notify_ticket_comment() returns trigger
language plpgsql security definer set search_path=public as $$
declare t public.tickets%rowtype;
begin
  select * into t from public.tickets where id=new.ticket_id;
  perform public.enqueue_ticket_notification(t.created_by,t.id,'comment',
    'Nouveau commentaire sur le ticket : '||coalesce(t.numero,'#' || t.id::text),auth.uid());
  perform public.enqueue_ticket_notification(t.assigned_to,t.id,'comment',
    'Nouveau commentaire sur le ticket : '||coalesce(t.numero,'#' || t.id::text),auth.uid());
  return new;
end;
$$;

drop trigger if exists ticket_comment_notification_trigger on public.commentaires;
create trigger ticket_comment_notification_trigger
  after insert on public.commentaires
  for each row execute function public.notify_ticket_comment();

alter table public.notifications replica identity full;
do $$ begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end $$;

commit;
