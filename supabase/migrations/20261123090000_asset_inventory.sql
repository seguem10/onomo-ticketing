-- Hardware inventory per hotel (PCs, printers, Wi-Fi access points, servers…)
-- and the link between a ticket and the equipment it concerns, so the IT team
-- sees which equipment breaks down often. Only technicians (ticket:update:all)
-- and administrators see and edit it, and only for the hotels in their scope.
begin;

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  hotel text not null check (char_length(btrim(hotel)) between 1 and 120),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  type text not null default 'other' check (type in ('pc', 'laptop', 'printer', 'network', 'wifi', 'server', 'phone', 'tv', 'pos', 'other')),
  brand_model text check (brand_model is null or char_length(brand_model) <= 120),
  serial text check (serial is null or char_length(serial) <= 80),
  location text check (location is null or char_length(location) <= 120),
  status text not null default 'in_service' check (status in ('in_service', 'repair', 'retired')),
  purchased_on date,
  warranty_until date,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assets_hotel_idx on public.assets (hotel);

create table if not exists public.ticket_assets (
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (ticket_id, asset_id)
);
create index if not exists ticket_assets_asset_idx on public.ticket_assets (asset_id);

alter table public.assets enable row level security;
alter table public.ticket_assets enable row level security;
revoke all on public.assets from anon, authenticated;
revoke all on public.ticket_assets from anon, authenticated;
grant select, delete on public.assets to authenticated;
grant insert (hotel, name, type, brand_model, serial, location, status, purchased_on, warranty_until, notes) on public.assets to authenticated;
grant update (hotel, name, type, brand_model, serial, location, status, purchased_on, warranty_until, notes) on public.assets to authenticated;
grant select, delete on public.ticket_assets to authenticated;
grant insert (ticket_id, asset_id) on public.ticket_assets to authenticated;

-- Technician of the hotel (or administrator).
drop policy if exists assets_read on public.assets;
create policy assets_read on public.assets for select to authenticated
  using ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)));
drop policy if exists assets_insert on public.assets;
create policy assets_insert on public.assets for insert to authenticated
  with check ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel))
              and created_by = (select auth.uid()));
drop policy if exists assets_update on public.assets;
create policy assets_update on public.assets for update to authenticated
  using ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)))
  with check ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)));
drop policy if exists assets_delete on public.assets;
create policy assets_delete on public.assets for delete to authenticated
  using ((select public.has_permission('ticket:update:all')) and (select public.user_has_hotel_scope(hotel)));

-- A link is visible and editable when both the equipment and the ticket are:
-- the subqueries run under the assets and tickets policies. The equipment
-- must belong to the ticket's hotel.
drop policy if exists ticket_assets_read on public.ticket_assets;
create policy ticket_assets_read on public.ticket_assets for select to authenticated
  using (exists (select 1 from public.assets a where a.id = asset_id)
         and exists (select 1 from public.tickets t where t.id = ticket_id));
drop policy if exists ticket_assets_insert on public.ticket_assets;
create policy ticket_assets_insert on public.ticket_assets for insert to authenticated
  with check ((select public.has_permission('ticket:update:all'))
              and created_by = (select auth.uid())
              and exists (select 1 from public.assets a join public.tickets t on t.hotel = a.hotel
                          where a.id = asset_id and t.id = ticket_id));
drop policy if exists ticket_assets_delete on public.ticket_assets;
create policy ticket_assets_delete on public.ticket_assets for delete to authenticated
  using ((select public.has_permission('ticket:update:all'))
         and exists (select 1 from public.assets a where a.id = asset_id)
         and exists (select 1 from public.tickets t where t.id = ticket_id));

create or replace function public.assets_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists assets_touch on public.assets;
create trigger assets_touch before update on public.assets
  for each row execute function public.assets_touch();

commit;
