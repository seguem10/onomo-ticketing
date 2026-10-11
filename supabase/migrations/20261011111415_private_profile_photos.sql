begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-photos','profile-photos',false,1048576,array['image/png']);
create policy profile_photo_read on storage.objects for select to authenticated using(
 bucket_id='profile-photos' and (select private.mfa_access_ok()) and
 ((storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.utilisateurs u where u.auth_user_id::text=(storage.foldername(name))[1])
 or exists(select 1 from public.commentaires c where c.author_id::text=(storage.foldername(name))[1])));
create policy profile_photo_insert on storage.objects for insert to authenticated with check(
 bucket_id='profile-photos' and name=(select auth.uid())::text||'/avatar.png'
 and (select private.mfa_access_ok())
 and exists(select 1 from public.utilisateurs u where u.auth_user_id=(select auth.uid())));
create policy profile_photo_update on storage.objects for update to authenticated
 using(bucket_id='profile-photos' and name=(select auth.uid())::text||'/avatar.png' and (select private.mfa_access_ok()))
 with check(bucket_id='profile-photos' and name=(select auth.uid())::text||'/avatar.png' and (select private.mfa_access_ok())
 and exists(select 1 from public.utilisateurs u where u.auth_user_id=(select auth.uid())));
create policy profile_photo_delete on storage.objects for delete to authenticated using(
 bucket_id='profile-photos' and name=(select auth.uid())::text||'/avatar.png' and (select private.mfa_access_ok())
 and exists(select 1 from public.utilisateurs u where u.auth_user_id=(select auth.uid())));
commit;
