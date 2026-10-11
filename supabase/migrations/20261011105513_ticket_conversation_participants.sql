begin;
create table public.ticket_conversation_participants (
 ticket_id uuid not null references public.tickets(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 display_name text not null,
 role_label text not null,
 added_by uuid not null default auth.uid(),
 created_at timestamptz not null default now(),
 primary key(ticket_id,user_id)
);
create index conversation_participants_user_idx on public.ticket_conversation_participants(user_id);
alter table public.ticket_conversation_participants enable row level security;
grant select,insert,delete on public.ticket_conversation_participants to authenticated;
create policy conversation_participants_read on public.ticket_conversation_participants
 for select to authenticated using(exists(select 1 from public.tickets t where t.id=ticket_id));
create policy conversation_participants_add on public.ticket_conversation_participants
 for insert to authenticated with check(
 added_by=(select auth.uid()) and (select public.has_permission('ticket:update:all'))
 and exists(select 1 from public.tickets t cross join lateral public.ticket_assignment_candidates(t.hotel) c
 where t.id=ticket_id and c.assigned_to=user_id));
create policy conversation_participants_remove on public.ticket_conversation_participants
 for delete to authenticated using((select public.has_permission('ticket:update:all'))
 and exists(select 1 from public.tickets t where t.id=ticket_id));
create function public.set_ticket_participant_identity() returns trigger
 language plpgsql security invoker set search_path=public as $$
declare candidate record;
begin
 select c.* into candidate from public.tickets t
 cross join lateral public.ticket_assignment_candidates(t.hotel) c
 where t.id=new.ticket_id and c.assigned_to=new.user_id;
 if candidate.assigned_to is null then raise exception 'Participant outside authorized scope'; end if;
 new.display_name=trim(coalesce(candidate.prenom,'')||' '||coalesce(candidate.nom,''));
 new.role_label=candidate.role;
 new.added_by=auth.uid();
 return new;
end;
$$;
revoke all on function public.set_ticket_participant_identity() from public,anon,authenticated;
create trigger set_ticket_participant_identity before insert on public.ticket_conversation_participants
 for each row execute function public.set_ticket_participant_identity();
commit;
