-- Error journal: JavaScript errors seen in users' browsers, so the team learns
-- about a failure without waiting for a ticket. Any signed-in user can add
-- rows about their own session (MFA is not required: errors may happen before
-- it); only administrators read and clear them. Each user is capped at 60
-- rows per hour so a loop in the page cannot flood the table.
begin;

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('error', 'rejection', 'console')),
  message text not null check (char_length(message) between 1 and 500),
  source text check (source is null or char_length(source) <= 300),
  line integer,
  col integer,
  stack text check (stack is null or char_length(stack) <= 2000),
  page text check (page is null or char_length(page) <= 300),
  view text check (view is null or char_length(view) <= 60),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300)
);
create index if not exists client_errors_created_at_idx on public.client_errors (created_at desc);
create index if not exists client_errors_user_recent_idx on public.client_errors (user_id, created_at desc);

alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;
grant select, delete on public.client_errors to authenticated;
grant insert (kind, message, source, line, col, stack, page, view, app_version, user_agent) on public.client_errors to authenticated;

drop policy if exists client_errors_insert on public.client_errors;
create policy client_errors_insert on public.client_errors for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists client_errors_read on public.client_errors;
create policy client_errors_read on public.client_errors for select to authenticated
  using ((select public.is_admin()));

drop policy if exists client_errors_delete on public.client_errors;
create policy client_errors_delete on public.client_errors for delete to authenticated
  using ((select public.is_admin()));

create or replace function public.client_errors_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.client_errors e
      where e.user_id = new.user_id and e.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Trop d''erreurs signalées, réessayez plus tard' using errcode = '54000';
  end if;
  return new;
end;
$$;
revoke all on function public.client_errors_rate_limit() from public, anon, authenticated;

drop trigger if exists client_errors_rate_limit on public.client_errors;
create trigger client_errors_rate_limit before insert on public.client_errors
  for each row execute function public.client_errors_rate_limit();

commit;
