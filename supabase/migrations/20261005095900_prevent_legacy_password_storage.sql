-- Profiles contain business metadata only. Supabase Auth is the sole password
-- authority, so a password or password-derived value must never be persisted
-- in public.utilisateurs.
begin;

create or replace function public.reject_legacy_password_storage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(new.pwd, '')), '') is not null then
    raise exception 'Passwords must only be stored in Supabase Auth.' using errcode = '22023';
  end if;
  new.pwd := '';
  return new;
end;
$$;

revoke all on function public.reject_legacy_password_storage() from public, anon, authenticated;

drop trigger if exists utilisateurs_reject_legacy_password_storage on public.utilisateurs;
create trigger utilisateurs_reject_legacy_password_storage
before insert or update of pwd on public.utilisateurs
for each row execute function public.reject_legacy_password_storage();

commit;
