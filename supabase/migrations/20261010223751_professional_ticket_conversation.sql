-- ONOMO Support IT — professional ticket conversation.
-- Existing comments remain intact and are public by default.  Internal notes
-- are enforced by RLS, not by the browser UI.
begin;

alter table public.commentaires
  add column if not exists visibility text not null default 'public',
  add column if not exists author_id uuid,
  add column if not exists reply_to uuid references public.commentaires(id) on delete set null,
  add column if not exists client_message_id uuid;

alter table public.commentaires
  drop constraint if exists commentaires_visibility_check;
alter table public.commentaires
  add constraint commentaires_visibility_check
  check (visibility in ('public', 'internal'));

create unique index if not exists commentaires_client_message_id_unique
  on public.commentaires (client_message_id)
  where client_message_id is not null;
create index if not exists commentaires_ticket_created_idx
  on public.commentaires (ticket_id, created_at asc);
create index if not exists commentaires_reply_to_idx
  on public.commentaires (reply_to)
  where reply_to is not null;

drop policy if exists comments_read on public.commentaires;
create policy comments_read
  on public.commentaires for select to authenticated
  using (
    exists (
      select 1
      from public.tickets ticket
      where ticket.id = commentaires.ticket_id
    )
    and (
      visibility = 'public'
      or (select public.has_permission('ticket:update:all'))
    )
  );

drop policy if exists comments_write on public.commentaires;
create policy comments_write
  on public.commentaires for insert to authenticated
  with check (
    (select public.has_permission('comment:create'))
    and exists (
      select 1
      from public.tickets ticket
      where ticket.id = commentaires.ticket_id
    )
    and (author_id is null or author_id = (select auth.uid()))
    and (
      visibility = 'public'
      or (select public.has_permission('ticket:update:all'))
    )
  );

-- Never notify a requester about an internal IT note.  The author also does
-- not receive their own notification.
create or replace function public.onomo_comment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  ticket_number text;
  actor uuid := coalesce(new.author_id, auth.uid());
begin
  select coalesce(numero, id::text)
    into ticket_number
  from public.tickets
  where id = new.ticket_id;

  if ticket_number is null then
    return new;
  end if;

  for recipient in
    select recipient_id
    from public.ticket_notification_recipient_ids(new.ticket_id)
    where recipient_id is distinct from actor
      and (
        new.visibility = 'public'
        or exists (
          select 1
          from public.app_user_roles ur
          join public.app_roles r on r.id = ur.role_id
          where ur.user_id = recipient_id
            and (
              r.name = 'Administrateur'
              or r.permissions ? '*'
              or r.permissions ? 'ticket:update:all'
            )
        )
      )
  loop
    perform public.onomo_notify(
      recipient,
      new.ticket_id,
      case when new.visibility = 'internal' then 'internal_note' else 'comment' end,
      jsonb_build_object(
        'key', case when new.visibility = 'internal' then 'ticket_internal_note_added' else 'ticket_comment_added' end,
        'ticket', ticket_number
      )
    );
  end loop;

  return new;
end;
$$;

revoke all on function public.onomo_comment_notifications() from public, anon, authenticated;

commit;
