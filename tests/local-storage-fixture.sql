-- LOCAL ONLY; link Storage access to the minimal REST ticket RLS fixture.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('recipe-private','recipe-private',false,1048576,array['text/plain']) on conflict(id) do nothing;
create policy recipe_storage_read on storage.objects for select to authenticated using(bucket_id='recipe-private' and exists(select 1 from public.recipe_tickets t where t.id::text=split_part(storage.objects.name,'/',1)));
create policy recipe_storage_insert on storage.objects for insert to authenticated with check(bucket_id='recipe-private' and exists(select 1 from public.recipe_tickets t where t.id::text=split_part(storage.objects.name,'/',1) and t.created_by=auth.uid()));
