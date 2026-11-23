-- Canned replies: a library of ready-made answers shared by the technicians
-- (anyone allowed to update tickets: IT Hotel, IT Regional, administrators).
-- Every technician can add one; only its author or an administrator can
-- change or delete it. Requesters, directors and HR never see the library.
begin;

create table if not exists public.canned_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.canned_replies enable row level security;
revoke all on public.canned_replies from anon, authenticated;
grant select, delete on public.canned_replies to authenticated;
grant insert (title, body) on public.canned_replies to authenticated;
grant update (title, body) on public.canned_replies to authenticated;

drop policy if exists canned_replies_read on public.canned_replies;
create policy canned_replies_read on public.canned_replies for select to authenticated
  using ((select public.has_permission('ticket:update:all')));

drop policy if exists canned_replies_insert on public.canned_replies;
create policy canned_replies_insert on public.canned_replies for insert to authenticated
  with check ((select public.has_permission('ticket:update:all'))
              and created_by = (select auth.uid()));

drop policy if exists canned_replies_update on public.canned_replies;
create policy canned_replies_update on public.canned_replies for update to authenticated
  using ((select public.is_admin())
         or ((select public.has_permission('ticket:update:all')) and created_by = (select auth.uid())))
  with check ((select public.is_admin())
              or ((select public.has_permission('ticket:update:all')) and created_by = (select auth.uid())));

drop policy if exists canned_replies_delete on public.canned_replies;
create policy canned_replies_delete on public.canned_replies for delete to authenticated
  using ((select public.is_admin())
         or ((select public.has_permission('ticket:update:all')) and created_by = (select auth.uid())));

create or replace function public.canned_replies_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists canned_replies_touch on public.canned_replies;
create trigger canned_replies_touch before update on public.canned_replies
  for each row execute function public.canned_replies_touch();

commit;
