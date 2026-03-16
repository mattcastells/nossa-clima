-- Iteracion 8d: materiales con medidas + precio por metro manual o calculado

do $$
begin
  create type public.measure_pricing_mode as enum ('manual', 'calculated');
exception
  when duplicate_object then null;
end;
$$;

alter table public.items
add column if not exists base_price_label text;

create table if not exists public.item_measurements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  label text not null check (char_length(trim(label)) > 0),
  unit text not null default 'mt' check (char_length(trim(unit)) > 0),
  pricing_mode public.measure_pricing_mode not null default 'manual',
  grams_per_meter numeric(12,3),
  notes text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  alter table public.item_measurements
  add constraint item_measurements_grams_per_meter_positive
  check (grams_per_meter is null or grams_per_meter > 0);
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.item_measurements
  add constraint item_measurements_pricing_mode_check
  check (
    (pricing_mode = 'manual' and grams_per_meter is null)
    or (pricing_mode = 'calculated' and grams_per_meter is not null)
  );
exception
  when duplicate_object then null;
end;
$$;

create unique index if not exists item_measurements_item_label_active_idx
  on public.item_measurements(item_id, lower(label))
  where archived_at is null;

create index if not exists item_measurements_item_sort_idx
  on public.item_measurements(item_id, archived_at, sort_order, label);

create table if not exists public.store_item_measure_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  store_id uuid not null references public.stores(id) on delete restrict,
  item_measurement_id uuid not null references public.item_measurements(id) on delete restrict,
  price numeric(12,2) not null check (price > 0),
  currency text not null default 'ARS',
  observed_at timestamptz not null,
  source_type public.source_type not null default 'manual_update',
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists store_item_measure_prices_measure_store_observed_idx
  on public.store_item_measure_prices(item_measurement_id, store_id, observed_at desc, created_at desc);

create or replace function public.validate_item_measurement_integrity()
returns trigger
language plpgsql
as $$
declare
  item_ok boolean;
begin
  select exists (
    select 1
    from public.items i
    where i.id = new.item_id
      and (tg_op <> 'INSERT' or i.archived_at is null)
  ) into item_ok;

  if not item_ok then
    raise exception 'Item invalid or archived';
  end if;

  return new;
end;
$$;

create or replace function public.validate_store_item_measure_price_integrity()
returns trigger
language plpgsql
as $$
declare
  store_ok boolean;
  measurement_ok boolean;
begin
  select exists(
    select 1
    from public.stores s
    where s.id = new.store_id
      and s.archived_at is null
  ) into store_ok;

  if not store_ok then
    raise exception 'Store invalid or archived';
  end if;

  select exists(
    select 1
    from public.item_measurements im
    join public.items i on i.id = im.item_id
    where im.id = new.item_measurement_id
      and im.archived_at is null
      and i.archived_at is null
  ) into measurement_ok;

  if not measurement_ok then
    raise exception 'Measurement invalid or archived';
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is null then
      new.user_id = auth.uid();
    end if;

    if new.user_id is distinct from auth.uid() then
      raise exception 'user_id must match authenticated user';
    end if;
  elsif new.user_id is distinct from old.user_id then
    raise exception 'user_id is immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists item_measurements_set_updated_at on public.item_measurements;
drop trigger if exists item_measurements_set_shared_catalog_audit on public.item_measurements;
drop trigger if exists item_measurements_validate_integrity on public.item_measurements;
drop trigger if exists store_item_measure_prices_validate_integrity on public.store_item_measure_prices;

create trigger item_measurements_set_updated_at
before update on public.item_measurements
for each row execute function public.set_updated_at();

create trigger item_measurements_set_shared_catalog_audit
before insert or update on public.item_measurements
for each row execute function public.set_shared_catalog_audit_fields();

create trigger item_measurements_validate_integrity
before insert or update on public.item_measurements
for each row execute function public.validate_item_measurement_integrity();

create trigger store_item_measure_prices_validate_integrity
before insert or update on public.store_item_measure_prices
for each row execute function public.validate_store_item_measure_price_integrity();

alter table public.item_measurements enable row level security;
alter table public.store_item_measure_prices enable row level security;

drop policy if exists "item_measurements_select_shared" on public.item_measurements;
drop policy if exists "item_measurements_insert_shared" on public.item_measurements;
drop policy if exists "item_measurements_update_shared" on public.item_measurements;
drop policy if exists "measure_prices_select_shared" on public.store_item_measure_prices;
drop policy if exists "measure_prices_insert_shared" on public.store_item_measure_prices;
drop policy if exists "measure_prices_update_own" on public.store_item_measure_prices;
drop policy if exists "measure_prices_delete_own" on public.store_item_measure_prices;

create policy "item_measurements_select_shared"
on public.item_measurements
for select
to authenticated
using (true);

create policy "item_measurements_insert_shared"
on public.item_measurements
for insert
to authenticated
with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

create policy "item_measurements_update_shared"
on public.item_measurements
for update
to authenticated
using (true)
with check (true);

create policy "measure_prices_select_shared"
on public.store_item_measure_prices
for select
to authenticated
using (true);

create policy "measure_prices_insert_shared"
on public.store_item_measure_prices
for insert
to authenticated
with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

create policy "measure_prices_update_own"
on public.store_item_measure_prices
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "measure_prices_delete_own"
on public.store_item_measure_prices
for delete
to authenticated
using (user_id = auth.uid());

alter table public.quote_material_items
add column if not exists item_measurement_id uuid references public.item_measurements(id) on delete restrict,
add column if not exists item_measurement_snapshot text;

create index if not exists quote_material_items_measurement_idx
  on public.quote_material_items(item_measurement_id);

create or replace function public.validate_quote_material_item_integrity()
returns trigger
language plpgsql
as $$
declare
  quote_owner uuid;
  quote_default_margin numeric(12,2);
  item_ok boolean;
  store_ok boolean;
  measurement_ok boolean;
  item_has_measurements boolean;
  effective_margin numeric(12,2);
  require_active_item boolean;
  require_active_store boolean;
  require_active_measurement boolean;
begin
  select q.user_id, q.default_material_margin_percent
  into quote_owner, quote_default_margin
  from public.quotes q
  where q.id = new.quote_id;

  if quote_owner is null then
    raise exception 'Quote not found';
  end if;

  if new.user_id <> auth.uid() then
    raise exception 'user_id must match authenticated user';
  end if;

  if quote_owner <> new.user_id then
    raise exception 'Quote user mismatch';
  end if;

  if tg_op = 'INSERT' then
    require_active_item = true;
    require_active_store = true;
    require_active_measurement = true;
  else
    require_active_item = old.item_id is distinct from new.item_id;
    require_active_store = old.source_store_id is distinct from new.source_store_id;
    require_active_measurement =
      old.item_measurement_id is distinct from new.item_measurement_id
      or old.item_id is distinct from new.item_id;
  end if;

  select exists (
    select 1
    from public.items i
    where i.id = new.item_id
      and (not require_active_item or i.archived_at is null)
  ) into item_ok;

  if not item_ok then
    raise exception 'Item invalid for current quote';
  end if;

  select exists (
    select 1
    from public.item_measurements im
    where im.item_id = new.item_id
      and im.archived_at is null
  ) into item_has_measurements;

  if item_has_measurements and new.item_measurement_id is null then
    raise exception 'Measurement required for current quote';
  end if;

  if new.item_measurement_id is not null then
    select exists (
      select 1
      from public.item_measurements im
      where im.id = new.item_measurement_id
        and im.item_id = new.item_id
        and (not require_active_measurement or im.archived_at is null)
    ) into measurement_ok;

    if not measurement_ok then
      raise exception 'Measurement invalid for current quote';
    end if;
  end if;

  if new.source_store_id is not null then
    select exists (
      select 1
      from public.stores s
      where s.id = new.source_store_id
        and (not require_active_store or s.archived_at is null)
    ) into store_ok;

    if not store_ok then
      raise exception 'Source store invalid for current quote';
    end if;
  end if;

  effective_margin = coalesce(new.margin_percent, quote_default_margin, 0);
  new.total_price = round((new.quantity * new.unit_price * (1 + effective_margin / 100))::numeric, 2);

  return new;
end;
$$;

drop view if exists public.latest_effective_store_item_measure_prices;
drop view if exists public.latest_store_item_measure_prices;
drop view if exists public.item_measure_price_history;

create view public.item_measure_price_history as
select
  p.id::text as id,
  p.user_id,
  p.store_id,
  s.name as store_name,
  im.item_id,
  i.name as item_name,
  i.category as item_category,
  i.base_price_label,
  im.id as item_measurement_id,
  im.label as item_measurement_label,
  im.unit as measurement_unit,
  im.pricing_mode,
  im.grams_per_meter,
  p.price,
  p.price as base_price,
  p.currency,
  p.observed_at,
  p.source_type,
  p.notes,
  p.created_at,
  'manual'::text as price_origin
from public.store_item_measure_prices p
join public.stores s on s.id = p.store_id
join public.item_measurements im on im.id = p.item_measurement_id
join public.items i on i.id = im.item_id
where im.archived_at is null

union all

select
  ('calculated-' || p.id::text || '-' || im.id::text) as id,
  p.user_id,
  p.store_id,
  s.name as store_name,
  i.id as item_id,
  i.name as item_name,
  i.category as item_category,
  coalesce(i.base_price_label, i.name) as base_price_label,
  im.id as item_measurement_id,
  im.label as item_measurement_label,
  im.unit as measurement_unit,
  im.pricing_mode,
  im.grams_per_meter,
  round((p.price * im.grams_per_meter / 1000)::numeric, 2) as price,
  p.price as base_price,
  p.currency,
  p.observed_at,
  p.source_type,
  p.notes,
  p.created_at,
  'calculated'::text as price_origin
from public.store_item_prices p
join public.stores s on s.id = p.store_id
join public.items i on i.id = p.item_id
join public.item_measurements im on im.item_id = i.id
where im.pricing_mode = 'calculated'
  and im.archived_at is null;

create view public.latest_store_item_measure_prices as
select distinct on (p.store_id, p.item_measurement_id)
  p.id,
  p.user_id,
  p.store_id,
  s.name as store_name,
  im.item_id,
  i.name as item_name,
  i.category as item_category,
  i.base_price_label,
  p.item_measurement_id,
  im.label as item_measurement_label,
  im.unit as measurement_unit,
  im.pricing_mode,
  im.grams_per_meter,
  p.price,
  p.currency,
  p.observed_at,
  p.source_type,
  p.notes,
  p.created_at
from public.store_item_measure_prices p
join public.stores s on s.id = p.store_id
join public.item_measurements im on im.id = p.item_measurement_id
join public.items i on i.id = im.item_id
where im.archived_at is null
order by p.store_id, p.item_measurement_id, p.observed_at desc, p.created_at desc;

create view public.latest_effective_store_item_measure_prices as
select distinct on (history.store_id, history.item_measurement_id)
  history.id,
  history.user_id,
  history.store_id,
  history.store_name,
  history.item_id,
  history.item_name,
  history.item_category,
  history.base_price_label,
  history.item_measurement_id,
  history.item_measurement_label,
  history.measurement_unit,
  history.pricing_mode,
  history.grams_per_meter,
  history.price,
  history.base_price,
  history.currency,
  history.observed_at,
  history.source_type,
  history.notes,
  history.created_at,
  history.price_origin
from public.item_measure_price_history history
order by history.store_id, history.item_measurement_id, history.observed_at desc, history.created_at desc;

alter view public.item_measure_price_history set (security_invoker = true);
alter view public.latest_store_item_measure_prices set (security_invoker = true);
alter view public.latest_effective_store_item_measure_prices set (security_invoker = true);

grant select on public.item_measure_price_history to authenticated;
grant select on public.latest_store_item_measure_prices to authenticated;
grant select on public.latest_effective_store_item_measure_prices to authenticated;
