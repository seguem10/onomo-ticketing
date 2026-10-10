begin;

-- activity_log is an authenticated audit trail.  Its RLS policies already
-- reject anonymous access; removing the SQL grants prevents accidental future
-- exposure if a policy is changed or added incorrectly.
revoke all privileges on table public.activity_log from anon;

commit;
