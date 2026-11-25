-- Inventory follows the hotels' inventory workbook ("Inventaire Materiels IT"):
-- one tab per domain (IT, mechanical, electrical, plumbing, fire safety,
-- elevators, kitchen, architecture), a free equipment type, a quantity for
-- items counted in bulk (cameras, access points, detectors…) and the
-- documents provided. More IT types are added for the IT tab's sections.
begin;

alter table public.assets
  add column if not exists domain text not null default 'it',
  add column if not exists subtype text,
  add column if not exists quantity integer not null default 1,
  add column if not exists documents text;

alter table public.assets drop constraint if exists assets_domain_check;
alter table public.assets add constraint assets_domain_check
  check (domain in ('it', 'mechanical', 'electrical', 'plumbing', 'fire', 'elevator', 'kitchen', 'architecture', 'other'));
alter table public.assets drop constraint if exists assets_subtype_check;
alter table public.assets add constraint assets_subtype_check
  check (subtype is null or char_length(subtype) <= 120);
alter table public.assets drop constraint if exists assets_quantity_check;
alter table public.assets add constraint assets_quantity_check
  check (quantity between 1 and 100000);
alter table public.assets drop constraint if exists assets_documents_check;
alter table public.assets add constraint assets_documents_check
  check (documents is null or char_length(documents) <= 200);

alter table public.assets drop constraint if exists assets_type_check;
alter table public.assets add constraint assets_type_check
  check (type in ('pc', 'laptop', 'monitor', 'tablet', 'printer', 'network', 'wifi', 'server', 'ups', 'phone', 'camera', 'access', 'tv', 'pos', 'other'));

create index if not exists assets_hotel_domain_idx on public.assets (hotel, domain);

grant insert (domain, subtype, quantity, documents) on public.assets to authenticated;
grant update (domain, subtype, quantity, documents) on public.assets to authenticated;

commit;
