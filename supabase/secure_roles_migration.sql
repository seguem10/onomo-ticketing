-- Onomo Support IT: exécuter ce script dans Supabase après migration vers Supabase Auth.
-- Il remplace les politiques publiques "allow_all" de l'ancienne application.
create table if not exists app_roles (
  id uuid primary key default gen_random_uuid(), name text unique not null,
  permissions jsonb not null default '[]', is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists app_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references app_roles(id) on delete cascade,
  primary key (user_id, role_id)
);
alter table tickets add column if not exists created_by uuid references auth.users(id);
alter table utilisateurs add column if not exists roles jsonb not null default '[]';
alter table utilisateurs add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;
alter table utilisateurs add column if not exists language text not null default 'fr' check(language in ('fr','en','ar'));
create table if not exists audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references auth.users(id), action text not null,
  entity_type text not null, entity_id text, metadata jsonb not null default '{}', ip inet, user_agent text,
  created_at timestamptz not null default now()
);
insert into app_roles(name,permissions,is_system) values
 ('Administrateur','["*"]',true),('IT Regional','["*"]',true),('IT Hotel','["*"]',true),('Directeur','["ticket:read","comment:create","comment:read"]',true),
 ('Demandeur','["ticket:create","ticket:read:own","comment:read:own"]',true)
on conflict(name) do nothing;
-- Correctif : la Direction est un rôle de consultation (lecture des tickets/rapports),
-- pas un rôle opérationnel. Si cette migration a déjà tourné avec l'ancienne valeur
-- ('Directeur','["*"]'), la ligne ci-dessous corrige les installations existantes.
update app_roles set permissions='["ticket:read","comment:create","comment:read"]'
where name='Directeur' and permissions='["*"]'::jsonb;
create or replace function public.has_permission(permission_name text) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from app_user_roles ur join app_roles r on r.id=ur.role_id where ur.user_id=auth.uid() and (r.permissions ? '*' or r.permissions ? permission_name));
$$;
alter table audit_logs enable row level security;
create policy audit_admin_read on audit_logs for select using (public.has_permission('*'));
alter table tickets enable row level security;
alter table commentaires enable row level security;
drop policy if exists "allow_all" on tickets; drop policy if exists "allow_all" on commentaires;
create policy tickets_read on tickets for select using (public.has_permission('*') or created_by=auth.uid());
create policy tickets_create on tickets for insert with check (public.has_permission('ticket:create') or created_by=auth.uid());
create policy tickets_update on tickets for update using (public.has_permission('*') or created_by=auth.uid()) with check (public.has_permission('*') or created_by=auth.uid());
create policy comments_read on commentaires for select using (public.has_permission('*') or exists(select 1 from tickets t where t.id=commentaires.ticket_id and t.created_by=auth.uid()));
create policy comments_write on commentaires for insert with check (public.has_permission('*') or exists(select 1 from tickets t where t.id=commentaires.ticket_id and t.created_by=auth.uid()));
