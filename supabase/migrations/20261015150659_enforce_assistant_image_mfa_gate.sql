-- SEC-09: preserve owner/folder policies, but require the existing MFA gate.
-- Other buckets retain their existing policies unchanged.
begin;
create policy assistant_images_mfa_gate
on storage.objects
as restrictive
for all
to authenticated
using (bucket_id <> 'it-assistant-images' or (select private.mfa_access_ok()))
with check (bucket_id <> 'it-assistant-images' or (select private.mfa_access_ok()));
commit;
