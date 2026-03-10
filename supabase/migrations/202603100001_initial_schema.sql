-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type public.item_type as enum ('product', 'tool', 'material', 'other');
create type public.source_type as enum ('purchase', 'manual_update', 'quote', 'other');

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tables
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  address text,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  category text,
  unit text,
  sku text,
  brand text,
  item_type public.item_type not null default 'product',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_item_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete restrict,
  item_id uuid not null references public.items(id) on delete restrict,
  price numeric(12,2) not null check (price > 0),
  currency text not null default 'ARS',
  observed_at timestamptz not null,
  source_type public.source_type not null default 'manual_update',
  quantity_reference text,
  notes text,
  created_at timestamptz not null default now()
);

-- Integrity function: prevent using inactive/foreign entities in price records
create or replace function public.validate_store_item_price_integrity()
returns trigger
language plpgsql
as $$
declare
  store_ok boolean;
  item_ok boolean;
begin
  select exists(
    select 1 from public.stores s
    where s.id = new.store_id and s.user_id = auth.uid() and s.is_active = true
  ) into store_ok;

  if not store_ok then
    raise exception 'Store invalid/inactive for current user';
  end if;

  select exists(
    select 1 from public.items i
    where i.id = new.item_id and i.user_id = auth.uid() and i.is_active = true
  ) into item_ok;

  if not item_ok then
    raise exception 'Item invalid/inactive for current user';
  end if;

  if new.user_id <> auth.uid() then
    raise exception 'user_id must match authenticated user';
  end if;

  return new;
end;
$$;

-- Default ownership on insert
create or replace function public.set_user_id_default()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is null then
    new.user_id = auth.uid();
  end if;
  return new;
end;
$$;

create trigger stores_set_updated_at before update on public.stores for each row execute function public.set_updated_at();
create trigger items_set_updated_at before update on public.items for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create trigger stores_set_user_id before insert on public.stores for each row execute function public.set_user_id_default();
create trigger items_set_user_id before insert on public.items for each row execute function public.set_user_id_default();
create trigger prices_set_user_id before insert on public.store_item_prices for each row execute function public.set_user_id_default();

create trigger validate_price_integrity before insert or update on public.store_item_prices
for each row execute function public.validate_store_item_price_integrity();

-- Useful indexes
create index stores_user_id_idx on public.stores(user_id, is_active);
create index items_user_id_idx on public.items(user_id, is_active);
create index prices_user_item_store_observed_idx
  on public.store_item_prices(user_id, item_id, store_id, observed_at desc);

-- Views
create or replace view public.item_price_history as
select
  p.id,
  p.user_id,
  p.store_id,
  s.name as store_name,
  p.item_id,
  i.name as item_name,
  p.price,
  p.currency,
  p.observed_at,
  p.source_type,
  p.quantity_reference,
  p.notes,
  p.created_at
from public.store_item_prices p
join public.stores s on s.id = p.store_id
join public.items i on i.id = p.item_id;

create or replace view public.latest_store_item_prices as
select distinct on (p.user_id, p.store_id, p.item_id)
  p.id,
  p.user_id,
  p.store_id,
  s.name as store_name,
  p.item_id,
  i.name as item_name,
  p.price,
  p.currency,
  p.observed_at,
  p.source_type,
  p.quantity_reference,
  p.notes,
  p.created_at
from public.store_item_prices p
join public.stores s on s.id = p.store_id
join public.items i on i.id = p.item_id
order by p.user_id, p.store_id, p.item_id, p.observed_at desc, p.created_at desc;

create or replace view public.cheapest_store_by_item as
with ranked as (
  select
    l.*,
    row_number() over (partition by l.user_id, l.item_id order by l.price asc, l.observed_at desc) as rn
  from public.latest_store_item_prices l
)
select * from ranked where rn = 1;

create or replace view public.store_price_comparison as
select
  l.user_id,
  l.item_id,
  l.item_name,
  l.store_id,
  l.store_name,
  l.price,
  l.currency,
  l.observed_at,
  c.store_id as cheapest_store_id,
  c.store_name as cheapest_store_name,
  c.price as cheapest_price,
  (l.price - c.price) as price_delta
from public.latest_store_item_prices l
join public.cheapest_store_by_item c
  on c.user_id = l.user_id and c.item_id = l.item_id;

-- RLS
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.items enable row level security;
alter table public.store_item_prices enable row level security;

create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "stores_select_own" on public.stores for select using (user_id = auth.uid());
create policy "stores_insert_own" on public.stores for insert with check (user_id = auth.uid());
create policy "stores_update_own" on public.stores for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "stores_delete_own" on public.stores for delete using (user_id = auth.uid());

create policy "items_select_own" on public.items for select using (user_id = auth.uid());
create policy "items_insert_own" on public.items for insert with check (user_id = auth.uid());
create policy "items_update_own" on public.items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "items_delete_own" on public.items for delete using (user_id = auth.uid());

create policy "prices_select_own" on public.store_item_prices for select using (user_id = auth.uid());
create policy "prices_insert_own" on public.store_item_prices for insert with check (user_id = auth.uid());
create policy "prices_update_own" on public.store_item_prices for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "prices_delete_own" on public.store_item_prices for delete using (user_id = auth.uid());

-- Ensure views respect user data through security_invoker
alter view public.item_price_history set (security_invoker = true);
alter view public.latest_store_item_prices set (security_invoker = true);
alter view public.cheapest_store_by_item set (security_invoker = true);
alter view public.store_price_comparison set (security_invoker = true);
