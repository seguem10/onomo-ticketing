-- ONOMO Support IT — private photo attachments for Assistant IT conversations.
-- Run after p21_ai_it_assistant.sql. Photos are never public and remain private
-- to the conversation owner until the user creates a ticket, where the source
-- image is uploaded through the existing private ticket-attachment flow.

begin;

create table if not exists public.it_ai_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.it_ai_conversations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  file_size bigint not null check (file_size > 0 and file_size <= 5242880),
  created_at timestamptz not null default now()
);

create index if not exists it_ai_attachments_conversation_created_idx
  on public.it_ai_attachments(conversation_id, created_at asc);

alter table public.it_ai_attachments enable row level security;

drop policy if exists it_ai_attachments_own_read on public.it_ai_attachments;
drop policy if exists it_ai_attachments_own_insert on public.it_ai_attachments;
drop policy if exists it_ai_attachments_own_delete on public.it_ai_attachments;

create policy it_ai_attachments_own_read on public.it_ai_attachments for select to authenticated
  using (uploaded_by=(select auth.uid()) and exists (
    select 1 from public.it_ai_conversations c where c.id=conversation_id and c.user_id=(select auth.uid())
  ));
create policy it_ai_attachments_own_insert on public.it_ai_attachments for insert to authenticated
  with check (uploaded_by=(select auth.uid()) and exists (
    select 1 from public.it_ai_conversations c where c.id=conversation_id and c.user_id=(select auth.uid())
  ));
create policy it_ai_attachments_own_delete on public.it_ai_attachments for delete to authenticated
  using (uploaded_by=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('it-assistant-images','it-assistant-images',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists it_assistant_images_owner_read on storage.objects;
drop policy if exists it_assistant_images_owner_insert on storage.objects;
drop policy if exists it_assistant_images_owner_delete on storage.objects;

create policy it_assistant_images_owner_read on storage.objects for select to authenticated
  using (bucket_id='it-assistant-images' and owner_id=(select auth.uid()::text) and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy it_assistant_images_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id='it-assistant-images' and owner_id=(select auth.uid()::text) and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy it_assistant_images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id='it-assistant-images' and owner_id=(select auth.uid()::text) and (storage.foldername(name))[1]=(select auth.uid()::text));

revoke all on public.it_ai_attachments from anon;
grant select,insert,delete on public.it_ai_attachments to authenticated;

commit;
