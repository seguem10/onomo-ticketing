begin;
create table public.ticket_message_files (
 id uuid primary key default gen_random_uuid(),
 comment_id uuid not null references public.commentaires(id) on delete cascade,
 uploaded_by uuid not null default auth.uid(),
 file_name text not null check (length(file_name) between 1 and 255),
 storage_path text not null unique,
 content_type text not null check (content_type in ('image/png','image/jpeg','image/webp','application/pdf','text/plain')),
 file_size bigint not null check (file_size between 1 and 10485760),
 created_at timestamptz not null default now(),
 check (split_part(storage_path,'/',1)=comment_id::text)
);
create index ticket_message_files_comment_idx on public.ticket_message_files(comment_id);
alter table public.ticket_message_files enable row level security;
grant select,insert on public.ticket_message_files to authenticated;
create policy message_files_read on public.ticket_message_files for select to authenticated
 using (exists(select 1 from public.commentaires c where c.id=comment_id));
create policy message_files_insert on public.ticket_message_files for insert to authenticated
 with check (uploaded_by=(select auth.uid()) and exists(select 1 from public.commentaires c where c.id=comment_id and c.author_id=(select auth.uid())));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values ('ticket-message-files','ticket-message-files',false,10485760,array['image/png','image/jpeg','image/webp','application/pdf','text/plain'])
 on conflict(id) do nothing;
create policy message_objects_read on storage.objects for select to authenticated
 using (bucket_id='ticket-message-files' and exists(select 1 from public.commentaires c where c.id::text=split_part(name,'/',1)));
create policy message_objects_insert on storage.objects for insert to authenticated
 with check (bucket_id='ticket-message-files' and owner_id=(select auth.uid()::text) and exists(select 1 from public.commentaires c where c.id::text=split_part(name,'/',1) and c.author_id=(select auth.uid())));
create policy message_objects_cleanup on storage.objects for delete to authenticated
 using (bucket_id='ticket-message-files' and owner_id=(select auth.uid()::text) and exists(select 1 from public.commentaires c where c.id::text=split_part(name,'/',1) and c.author_id=(select auth.uid())));
commit;
