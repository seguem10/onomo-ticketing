-- ONOMO Support IT — AI assistant data model and least-privilege policies.
-- Run after p20_ticket_attachment_audit_legacy_compatibility.sql.
-- The assistant is advisory only. It never changes tickets or infrastructure.

begin;

create table if not exists public.it_procedures (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 240),
  domain text not null check (domain in ('microsoft365','sage1000','citrix','opera','pos','network','maintenance','general')),
  content text not null check (char_length(content) between 10 and 12000),
  source_label text not null check (char_length(source_label) between 2 and 240),
  source_url text,
  effective_date date not null default current_date,
  hotel text,
  is_validated boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.it_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null check (domain in ('microsoft365','sage1000','citrix','opera','pos','network','maintenance','general')),
  title text not null default 'Assistant IT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.it_ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.it_ai_conversations(id) on delete cascade,
  author text not null check (author in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_ai_solutions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id) on delete cascade,
  generated_by uuid not null references auth.users(id) on delete restrict,
  proposal jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','validated')),
  validated_solution text,
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists it_ai_conversations_owner_updated_idx on public.it_ai_conversations(user_id, updated_at desc);
create index if not exists it_ai_messages_conversation_created_idx on public.it_ai_messages(conversation_id, created_at);
create index if not exists it_procedures_validated_domain_idx on public.it_procedures(is_validated, domain);
create index if not exists ticket_ai_solutions_ticket_idx on public.ticket_ai_solutions(ticket_id);

create or replace function public.touch_it_ai_conversation()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end;
$$;
drop trigger if exists it_ai_conversations_touch on public.it_ai_conversations;
create trigger it_ai_conversations_touch before update on public.it_ai_conversations
for each row execute function public.touch_it_ai_conversation();

create or replace function public.touch_ticket_ai_solution()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end;
$$;
drop trigger if exists ticket_ai_solutions_touch on public.ticket_ai_solutions;
create trigger ticket_ai_solutions_touch before update on public.ticket_ai_solutions
for each row execute function public.touch_ticket_ai_solution();

create or replace function public.guard_ticket_ai_solution_write()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='UPDATE' and new.ticket_id is distinct from old.ticket_id then
    raise exception 'Ticket reference cannot be changed';
  end if;
  if tg_op='UPDATE' and new.generated_by is distinct from old.generated_by then
    raise exception 'Solution author cannot be changed';
  end if;
  if new.status='validated' and coalesce(trim(new.validated_solution),'')='' then
    raise exception 'A validated solution must contain technician guidance';
  end if;
  return new;
end;
$$;
drop trigger if exists ticket_ai_solutions_guard on public.ticket_ai_solutions;
create trigger ticket_ai_solutions_guard before insert or update on public.ticket_ai_solutions
for each row execute function public.guard_ticket_ai_solution_write();

alter table public.it_procedures enable row level security;
alter table public.it_ai_conversations enable row level security;
alter table public.it_ai_messages enable row level security;
alter table public.ticket_ai_solutions enable row level security;

do $$
declare target text; policy_name text;
begin
  foreach target in array array['it_procedures','it_ai_conversations','it_ai_messages','ticket_ai_solutions'] loop
    for policy_name in select policyname from pg_policies where schemaname='public' and tablename=target loop
      execute format('drop policy if exists %I on public.%I', policy_name, target);
    end loop;
  end loop;
end;
$$;

-- Only approved content is readable by support staff in their own hotel scope.
-- Procedure authoring and validation remain an Administrator action.
create policy it_procedures_read_validated on public.it_procedures for select to authenticated using (
  is_validated and (hotel is null or public.user_has_hotel_scope(hotel))
);
create policy it_procedures_admin_manage on public.it_procedures for all to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- A conversation belongs only to the user who started it. Support staff do not
-- receive a backdoor into private assistant discussions.
create policy it_ai_conversations_own on public.it_ai_conversations for select to authenticated
using (user_id=(select auth.uid()));
create policy it_ai_messages_own on public.it_ai_messages for select to authenticated
using (exists (select 1 from public.it_ai_conversations c where c.id=conversation_id and c.user_id=(select auth.uid())));

-- Ticket solutions inherit the existing tickets RLS decision.
create policy ticket_ai_solutions_read_ticket_scope on public.ticket_ai_solutions for select to authenticated using (
  exists (select 1 from public.tickets t where t.id=ticket_id)
);
create policy ticket_ai_solutions_write_authorized_it on public.ticket_ai_solutions for insert to authenticated with check (
  generated_by=(select auth.uid()) and (
    (select public.is_admin()) or
    (select public.has_permission('ticket:update:all')) or
    ((select public.has_permission('ticket:update:assigned')) and exists (select 1 from public.tickets t where t.id=ticket_id and t.assigned_to=(select auth.uid())))
  )
);
create policy ticket_ai_solutions_update_authorized_it on public.ticket_ai_solutions for update to authenticated using (
  (select public.is_admin()) or
  (select public.has_permission('ticket:update:all')) or
  ((select public.has_permission('ticket:update:assigned')) and exists (select 1 from public.tickets t where t.id=ticket_id and t.assigned_to=(select auth.uid())))
) with check (
  (select public.is_admin()) or
  (select public.has_permission('ticket:update:all')) or
  ((select public.has_permission('ticket:update:assigned')) and exists (select 1 from public.tickets t where t.id=ticket_id and t.assigned_to=(select auth.uid())))
);

revoke all on public.it_procedures, public.it_ai_conversations, public.it_ai_messages, public.ticket_ai_solutions from anon;
revoke insert, update, delete on public.it_ai_conversations, public.it_ai_messages from authenticated;
grant select on public.it_procedures, public.it_ai_conversations, public.it_ai_messages to authenticated;
grant select, insert, update on public.ticket_ai_solutions to authenticated;

commit;
