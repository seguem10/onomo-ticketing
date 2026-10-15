-- Emergency rollback: reintroduces SEC-09. Requires environment approval.
begin;
drop policy assistant_images_mfa_gate on storage.objects;
commit;
