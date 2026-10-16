-- LOCAL COMPOSE ONLY. Minimal policy model with real Supabase auth.uid().
-- This is not a complete copy of production triggers/schema.
create schema if not exists recipe;
create table if not exists recipe.accounts(user_id uuid primary key,role text not null,hotels text[] not null);
alter table recipe.accounts enable row level security;
create policy recipe_accounts_own on recipe.accounts for select to authenticated using(user_id=(select auth.uid()));
grant usage on schema recipe to authenticated;
grant select on recipe.accounts to authenticated;
create function recipe.is_admin() returns boolean language sql stable security invoker as $$select exists(select 1 from recipe.accounts where user_id=auth.uid() and role='admin')$$;
create function recipe.has_permission(p text) returns boolean language sql stable security invoker as $$select exists(select 1 from recipe.accounts where user_id=auth.uid() and (role in ('it_hotel','it_regional','admin') or p='ticket:read:own'))$$;
create function recipe.hotel_scope(h text) returns boolean language sql stable security invoker as $$select exists(select 1 from recipe.accounts where user_id=auth.uid() and (role='admin' or h=any(hotels)))$$;
revoke all on function recipe.is_admin(),recipe.has_permission(text),recipe.hotel_scope(text) from public,anon;
grant execute on function recipe.is_admin(),recipe.has_permission(text),recipe.hotel_scope(text) to authenticated;
create table public.recipe_tickets(id uuid primary key default gen_random_uuid(),hotel text not null,created_by uuid not null,assigned_to uuid,titre text);
alter table public.recipe_tickets enable row level security;
create policy recipe_read on public.recipe_tickets for select to authenticated using (
 recipe.is_admin() or (recipe.has_permission('ticket:read:all') and recipe.hotel_scope(hotel))
 or (recipe.has_permission('ticket:read:own') and created_by=auth.uid()) or (assigned_to=auth.uid() and recipe.hotel_scope(hotel)));
create policy recipe_create on public.recipe_tickets for insert to authenticated with check(recipe.has_permission('ticket:create') and recipe.hotel_scope(hotel) and created_by=auth.uid());
create policy recipe_update on public.recipe_tickets for update to authenticated using(recipe.is_admin() or (recipe.has_permission('ticket:update:all') and recipe.hotel_scope(hotel)) or created_by=auth.uid() or (assigned_to=auth.uid() and recipe.hotel_scope(hotel))) with check(recipe.is_admin() or (recipe.has_permission('ticket:update:all') and recipe.hotel_scope(hotel)) or created_by=auth.uid() or (assigned_to=auth.uid() and recipe.hotel_scope(hotel)));
grant select,insert,update on public.recipe_tickets to authenticated;
revoke all on public.recipe_tickets from anon;
notify pgrst,'reload schema';
