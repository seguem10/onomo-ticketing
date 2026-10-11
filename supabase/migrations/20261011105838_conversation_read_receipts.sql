begin;
create table public.ticket_message_reads (
 comment_id uuid not null references public.commentaires(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(),
 primary key(comment_id,user_id)
);
create index ticket_message_reads_user_idx on public.ticket_message_reads(user_id);
alter table public.ticket_message_reads enable row level security;
revoke all on public.ticket_message_reads from anon,authenticated;
grant select on public.ticket_message_reads to authenticated;
grant insert(comment_id,user_id) on public.ticket_message_reads to authenticated;
create policy message_reads_select on public.ticket_message_reads for select to authenticated
 using(exists(select 1 from public.commentaires c where c.id=comment_id
 and (user_id=(select auth.uid()) or c.author_id=(select auth.uid()))));
create policy message_reads_insert on public.ticket_message_reads for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.commentaires c where c.id=comment_id));
create view public.ticket_message_counts with(security_invoker=true) as
 select c.ticket_id,count(*) as message_count,
 count(*) filter(where c.author_id is distinct from (select auth.uid())
 and not exists(select 1 from public.ticket_message_reads r where r.comment_id=c.id and r.user_id=(select auth.uid()))) as unread_count
 from public.commentaires c group by c.ticket_id;
revoke all on public.ticket_message_counts from anon;
grant select on public.ticket_message_counts to authenticated;
commit;
