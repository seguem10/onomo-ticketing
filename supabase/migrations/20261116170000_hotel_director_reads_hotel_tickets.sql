-- Hotel directors (role "Directeur Hôtel") get the dashboard and reports for
-- their own hotel. ticket:read:all is still limited by tickets_read, which
-- requires user_has_hotel_scope(tickets.hotel): a director only reads the
-- tickets of the hotel(s) on their profile. report:read matches "Directeur".
-- Existing permissions are kept; the update is idempotent.
update public.app_roles
set permissions = (
  select jsonb_agg(distinct permission order by permission)
  from jsonb_array_elements_text(permissions || '["ticket:read:all","report:read"]'::jsonb) as permission
)
where name = 'Directeur Hôtel';
