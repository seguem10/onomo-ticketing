-- ONOMO Support IT — private, ticket-scoped attachments.
-- Apply after p12_ticket_related_rls_reconciliation.sql.

begin;

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  content_type text not null check (content_type in (
    'application/pdf','image/jpeg','image/png','image/webp','text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  created_at timestamptz not null default now()
);

create index if not exists ticket_attachments_ticket_id_created_at_idx
  on public.ticket_attachments(ticket_id, created_at asc);

alter table public.ticket_attachments enable row level security;

drop policy if exists ticket_attachments_read on public.ticket_attachments;
drop policy if exists ticket_attachments_insert on public.ticket_attachments;
drop policy if exists ticket_attachments_delete on public.ticket_attachments;

create policy ticket_attachments_read on public.ticket_attachments for select to authenticated
  using (exists(select 1 from public.tickets t where t.id=ticket_attachments.ticket_id));
create policy ticket_attachments_insert on public.ticket_attachments for insert to authenticated
  with check (uploaded_by=auth.uid() and exists(select 1 from public.tickets t where t.id=ticket_attachments.ticket_id));
create policy ticket_attachments_delete on public.ticket_attachments for delete to authenticated
  using (uploaded_by=auth.uid() or (select public.is_admin()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('ticket-attachments','ticket-attachments',false,10485760,array[
  'application/pdf','image/jpeg','image/png','image/webp','text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]) on conflict (id) do update set public=false,file_size_limit=10485760;

drop policy if exists ticket_attachment_objects_read on storage.objects;
drop policy if exists ticket_attachment_objects_insert on storage.objects;
drop policy if exists ticket_attachment_objects_delete on storage.objects;

create policy ticket_attachment_objects_read on storage.objects for select to authenticated
  using (bucket_id='ticket-attachments' and exists(select 1 from public.tickets t where t.id::text=split_part(name,'/',1)));
create policy ticket_attachment_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id='ticket-attachments' and owner_id=auth.uid()::text and exists(select 1 from public.tickets t where t.id::text=split_part(name,'/',1)));
create policy ticket_attachment_objects_delete on storage.objects for delete to authenticated
  using (bucket_id='ticket-attachments' and (owner_id=auth.uid()::text or (select public.is_admin())));

revoke all on public.ticket_attachments from anon;
grant select,insert,delete on public.ticket_attachments to authenticated;
commit;
