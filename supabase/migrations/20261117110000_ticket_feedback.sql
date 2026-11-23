-- Requester satisfaction: once a ticket is resolved or closed, the person who
-- created it can rate it from 1 to 5 with an optional comment, and change that
-- rating later. Anyone who can read the ticket (tickets RLS) can read its
-- rating, so IT, directors and HR see it in the ticket and in the reports.
begin;

create table if not exists public.ticket_feedback (
  ticket_id uuid primary key references public.tickets(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ticket_feedback enable row level security;
revoke all on public.ticket_feedback from anon, authenticated;
grant select on public.ticket_feedback to authenticated;
grant insert (ticket_id, rating, comment) on public.ticket_feedback to authenticated;
grant update (rating, comment) on public.ticket_feedback to authenticated;

-- Visible to whoever can read the ticket: the subquery runs under tickets RLS.
drop policy if exists ticket_feedback_read on public.ticket_feedback;
create policy ticket_feedback_read on public.ticket_feedback for select to authenticated
  using ((select private.mfa_access_ok())
         and exists (select 1 from public.tickets t where t.id = ticket_id));

-- Only the ticket's creator, only once it is resolved or closed.
drop policy if exists ticket_feedback_insert on public.ticket_feedback;
create policy ticket_feedback_insert on public.ticket_feedback for insert to authenticated
  with check ((select private.mfa_access_ok())
              and created_by = (select auth.uid())
              and exists (select 1 from public.tickets t
                          where t.id = ticket_id
                            and t.created_by = (select auth.uid())
                            and t.statut in ('résolu', 'fermé')));

drop policy if exists ticket_feedback_update on public.ticket_feedback;
create policy ticket_feedback_update on public.ticket_feedback for update to authenticated
  using ((select private.mfa_access_ok()) and created_by = (select auth.uid()))
  with check ((select private.mfa_access_ok())
              and created_by = (select auth.uid())
              and exists (select 1 from public.tickets t
                          where t.id = ticket_id
                            and t.created_by = (select auth.uid())
                            and t.statut in ('résolu', 'fermé')));

create or replace function public.ticket_feedback_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ticket_feedback_touch on public.ticket_feedback;
create trigger ticket_feedback_touch before update on public.ticket_feedback
  for each row execute function public.ticket_feedback_touch();

commit;
