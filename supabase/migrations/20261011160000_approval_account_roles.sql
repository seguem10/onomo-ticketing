begin;
-- New roles do not inherit legacy Direction or IT-wide access. Approval
-- permissions will be introduced with the separately scoped workflow.
insert into public.app_roles(name,permissions,is_system)
values
 ('Directeur Hôtel','["ticket:create","ticket:read:own","comment:create","comment:read:own"]'::jsonb,true),
 ('RH Régional','["ticket:create","ticket:read:own","comment:create","comment:read:own"]'::jsonb,true)
on conflict(name) do nothing;

alter table public.utilisateurs add constraint approval_role_scope_required
check (
 (role <> 'directeur_hotel' or nullif(btrim(hotel),'') is not null)
 and (role <> 'rh_regional' or coalesce((jsonb_typeof(hotels)='array' and jsonb_array_length(hotels)>0),false))
);
commit;
