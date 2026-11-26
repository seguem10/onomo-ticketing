-- IT assistant feedback: after an answer, the user says whether the problem
-- is solved or still blocking. One answer per conversation (the latest wins).
-- Users write only about their own conversations; administrators and
-- technicians read the summary (how many problems were solved without a
-- ticket), never the conversations themselves.
begin;

create table if not exists public.it_ai_feedback (
  conversation_id uuid primary key references public.it_ai_conversations(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  domain text,
  resolved boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists it_ai_feedback_created_idx on public.it_ai_feedback (created_at desc);

alter table public.it_ai_feedback enable row level security;
revoke all on public.it_ai_feedback from anon, authenticated;
grant select on public.it_ai_feedback to authenticated;
grant insert (conversation_id, resolved) on public.it_ai_feedback to authenticated;
grant update (resolved) on public.it_ai_feedback to authenticated;

drop policy if exists it_ai_feedback_own_read on public.it_ai_feedback;
create policy it_ai_feedback_own_read on public.it_ai_feedback for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists it_ai_feedback_own_insert on public.it_ai_feedback;
create policy it_ai_feedback_own_insert on public.it_ai_feedback for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.it_ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())));
drop policy if exists it_ai_feedback_own_update on public.it_ai_feedback;
create policy it_ai_feedback_own_update on public.it_ai_feedback for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The conversation's area is copied by the database, not trusted from the client.
create or replace function public.it_ai_feedback_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select c.domain into new.domain from public.it_ai_conversations c where c.id = new.conversation_id;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.it_ai_feedback_fill() from public, anon, authenticated;
drop trigger if exists it_ai_feedback_fill on public.it_ai_feedback;
create trigger it_ai_feedback_fill before insert or update on public.it_ai_feedback
  for each row execute function public.it_ai_feedback_fill();

-- Summary for administrators and technicians: counts only, no content.
create or replace function public.it_ai_feedback_summary(days integer default 30)
returns table (conversations bigint, answered bigint, resolved bigint, blocked bigint)
language sql
stable
security definer
set search_path = ''
as $$
  -- No row at all for users without the technician permission.
  select c.total, f.answered, f.resolved, f.blocked
  from (select count(*) as total from public.it_ai_conversations
        where created_at > now() - make_interval(days => greatest(1, least(days, 365)))) c,
       (select count(*) as answered,
               count(*) filter (where resolved) as resolved,
               count(*) filter (where not resolved) as blocked
        from public.it_ai_feedback
        where updated_at > now() - make_interval(days => greatest(1, least(days, 365)))) f
  where public.has_permission('ticket:update:all');
$$;
revoke all on function public.it_ai_feedback_summary(integer) from public, anon;
grant execute on function public.it_ai_feedback_summary(integer) to authenticated;

commit;
