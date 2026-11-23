-- Regional HR (role "RH Régional") gets the dashboard and reports for the
-- hotels on their profile, like "Directeur Hôtel". ticket:read:all is still
-- limited by tickets_read, which requires user_has_hotel_scope(tickets.hotel)
-- (utilisateurs.hotels for a regional profile). Idempotent.
update public.app_roles
set permissions = (
  select jsonb_agg(distinct permission order by permission)
  from jsonb_array_elements_text(permissions || '["ticket:read:all","report:read"]'::jsonb) as permission
)
where name = 'RH Régional';
