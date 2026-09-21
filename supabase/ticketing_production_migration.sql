-- ONOMO Support IT production workflow. Run after secure_roles_migration.sql.
-- Prerequisite: create real accounts in Supabase Auth and map each account in utilisateurs.auth_user_id.

create sequence if not exists public.ticket_number_seq start 1000;
alter table public.tickets add column if not exists ticket_number bigint;
alter table public.tickets add column if not exists updated_at timestamptz not null default now();
alter table public.tickets add column if not exists closed_at timestamptz;
update public.tickets set ticket_number=nextval('public.ticket_number_seq') where ticket_number is null;
alter table public.tickets alter column ticket_number set not null;
create unique index if not exists tickets_ticket_number_unique on public.tickets(ticket_number);

create table if not exists public.ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  actor_id uuid references auth.users(id), action text not null,
  old_values jsonb not null default '{}', new_values jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete cascade,
  type text not null, body jsonb not null default '{}', read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.ticket_workflow() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    if new.ticket_number is null then new.ticket_number:=nextval('public.ticket_number_seq'); end if;
    if new.numero is null or new.numero='' then new.numero:='#'||lpad(new.ticket_number::text,6,'0'); end if;
    new.updated_at:=now();
    insert into public.ticket_events(ticket_id,actor_id,action,new_values) values(new.id,auth.uid(),'created',to_jsonb(new));
    return new;
  end if;
  if new.statut='résolu' then new.statut:='fermé'; end if;
  if old.statut='fermé' and new.statut not in ('fermé','nouveau') and not public.has_permission('ticket:reopen') and not public.has_permission('*') then raise exception 'Ticket closed'; end if;
  if old.statut='fermé' and new.statut='nouveau' then new.closed_at:=null; end if;
  if new.statut='fermé' and old.statut is distinct from 'fermé' then new.closed_at:=now(); end if;
  new.updated_at:=now();
  insert into public.ticket_events(ticket_id,actor_id,action,old_values,new_values) values(new.id,auth.uid(),case when old.statut='fermé' and new.statut='nouveau' then 'reopened' when new.statut='fermé' then 'closed' when old.assigne_a is distinct from new.assigne_a then 'reassigned' else 'updated' end,to_jsonb(old),to_jsonb(new));
  return new;
end $$;
drop trigger if exists ticket_workflow_trigger on public.tickets;
create trigger ticket_workflow_trigger before insert or update on public.tickets for each row execute function public.ticket_workflow();

alter table public.tickets replica identity full;
alter table public.commentaires replica identity full;
do $$ begin alter publication supabase_realtime add table public.tickets; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.commentaires; exception when duplicate_object then null; end $$;

alter table public.ticket_events enable row level security;
alter table public.notifications enable row level security;
drop policy if exists ticket_events_read on public.ticket_events;
drop policy if exists notifications_own on public.notifications;
drop policy if exists notifications_read_own on public.notifications;
create policy ticket_events_read on public.ticket_events for select using(public.has_permission('*') or exists(select 1 from public.tickets t where t.id=ticket_events.ticket_id and t.created_by=auth.uid()));
create policy notifications_own on public.notifications for select using(recipient_id=auth.uid());
create policy notifications_read_own on public.notifications for update using(recipient_id=auth.uid()) with check(recipient_id=auth.uid());

-- Application settings: only global administrators can read/write them.
create table if not exists public.app_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id));
alter table public.app_settings enable row level security;
drop policy if exists settings_admin_only on public.app_settings;
create policy settings_admin_only on public.app_settings for all using(public.has_permission('*')) with check(public.has_permission('*'));
