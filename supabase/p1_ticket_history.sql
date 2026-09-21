-- ONOMO Support IT — ticket history events for comments.
-- Run after ticketing_production_migration.sql and p0_rls_hardening.sql.

begin;

create or replace function public.record_ticket_comment_event() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.ticket_events(ticket_id,actor_id,action,new_values)
  values (new.ticket_id,auth.uid(),'commented',to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists ticket_comment_event_trigger on public.commentaires;
create trigger ticket_comment_event_trigger
  after insert on public.commentaires
  for each row execute function public.record_ticket_comment_event();

commit;
