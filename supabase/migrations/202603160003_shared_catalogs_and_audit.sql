-- Iteracion 8b: catalogo compartido de tiendas/materiales + auditoria visible

alter table public.stores
add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.items
add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.stores
set updated_by = coalesce(updated_by, user_id)
where updated_by is null;

update public.items
set updated_by = coalesce(updated_by, user_id)
where updated_by is null;

alter table public.stores alter column user_id drop not null;
alter table public.items alter column user_id drop not null;
alter table public.store_item_prices alter column user_id drop not null;

alter table public.stores drop constraint if exists stores_user_id_fkey;
alter table public.items drop constraint if exists items_user_id_fkey;
alter table public.store_item_prices drop constraint if exists store_item_prices_user_id_fkey;

alter table public.stores
add constraint stores_user_id_fkey
foreign key (user_id) references auth.users(id) on delete set null;

alter table public.items
add constraint items_user_id_fkey
foreign key (user_id) references auth.users(id) on delete set null;

alter table public.store_item_prices
add constraint store_item_prices_user_id_fkey
foreign key (user_id) references auth.users(id) on delete set null;

create or replace function public.set_shared_catalog_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.user_id is null then
      new.user_id = auth.uid();
    end if;

    if new.updated_by is null then
      new.updated_by = coalesce(auth.uid(), new.user_id);
    end if;

    return new;
  end if;

  new.user_id = old.user_id;
  new.updated_by = coalesce(auth.uid(), old.updated_by, old.user_id);
  return new;
end;
$$;

drop trigger if exists stores_set_user_id on public.stores;
drop trigger if exists items_set_user_id on public.items;
drop trigger if exists stores_set_shared_catalog_audit on public.stores;
drop trigger if exists items_set_shared_catalog_audit on public.items;

create trigger stores_set_shared_catalog_audit
before insert or update on public.stores
for each row execute function public.set_shared_catalog_audit_fields();

create trigger items_set_shared_catalog_audit
before insert or update on public.items
for each row execute function public.set_shared_catalog_audit_fields();

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
    where s.id = new.store_id
      and s.archived_at is null
  ) into store_ok;

  if not store_ok then
    raise exception 'Store invalid or archived';
  end if;

  select exists(
    select 1 from public.items i
    where i.id = new.item_id
      and i.archived_at is null
  ) into item_ok;

  if not item_ok then
    raise exception 'Item invalid or archived';
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

create or replace function public.validate_quote_material_item_integrity()
returns trigger
language plpgsql
as $$
declare
  quote_owner uuid;
  quote_default_margin numeric(12,2);
  item_ok boolean;
  store_ok boolean;
  effective_margin numeric(12,2);
  require_active_item boolean;
  require_active_store boolean;
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
  else
    require_active_item = old.item_id is distinct from new.item_id;
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

  if new.source_store_id is not null then
    if tg_op = 'INSERT' then
      require_active_store = true;
    else
      require_active_store = old.source_store_id is distinct from new.source_store_id;
    end if;

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
select distinct on (p.store_id, p.item_id)
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
order by p.store_id, p.item_id, p.observed_at desc, p.created_at desc;

create or replace view public.cheapest_store_by_item as
with ranked as (
  select
    l.*,
    row_number() over (partition by l.item_id order by l.price asc, l.observed_at desc) as rn
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
  on c.item_id = l.item_id;

alter view public.item_price_history set (security_invoker = true);
alter view public.latest_store_item_prices set (security_invoker = true);
alter view public.cheapest_store_by_item set (security_invoker = true);
alter view public.store_price_comparison set (security_invoker = true);

create or replace view public.profile_directory as
select
  p.id,
  p.full_name
from public.profiles p;

grant select on public.profile_directory to authenticated;

drop index if exists public.stores_user_id_idx;
drop index if exists public.items_user_id_idx;
drop index if exists public.prices_user_item_store_observed_idx;
drop index if exists public.stores_user_archived_name_idx;
drop index if exists public.items_user_archived_name_idx;

create index if not exists stores_archived_name_idx on public.stores(archived_at, name);
create index if not exists items_archived_name_idx on public.items(archived_at, name);
create index if not exists prices_item_store_observed_idx
  on public.store_item_prices(item_id, store_id, observed_at desc);

drop policy if exists "stores_select_own" on public.stores;
drop policy if exists "stores_insert_own" on public.stores;
drop policy if exists "stores_update_own" on public.stores;
drop policy if exists "stores_delete_own" on public.stores;
drop policy if exists "stores_select_shared" on public.stores;
drop policy if exists "stores_insert_shared" on public.stores;
drop policy if exists "stores_update_shared" on public.stores;

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;
drop policy if exists "items_select_shared" on public.items;
drop policy if exists "items_insert_shared" on public.items;
drop policy if exists "items_update_shared" on public.items;

drop policy if exists "prices_select_own" on public.store_item_prices;
drop policy if exists "prices_insert_own" on public.store_item_prices;
drop policy if exists "prices_update_own" on public.store_item_prices;
drop policy if exists "prices_delete_own" on public.store_item_prices;
drop policy if exists "prices_select_shared" on public.store_item_prices;
drop policy if exists "prices_insert_shared" on public.store_item_prices;

create policy "stores_select_shared"
on public.stores
for select
to authenticated
using (true);

create policy "stores_insert_shared"
on public.stores
for insert
to authenticated
with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

create policy "stores_update_shared"
on public.stores
for update
to authenticated
using (true)
with check (true);

create policy "items_select_shared"
on public.items
for select
to authenticated
using (true);

create policy "items_insert_shared"
on public.items
for insert
to authenticated
with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

create policy "items_update_shared"
on public.items
for update
to authenticated
using (true)
with check (true);

create policy "prices_select_shared"
on public.store_item_prices
for select
to authenticated
using (true);

create policy "prices_insert_shared"
on public.store_item_prices
for insert
to authenticated
with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

create policy "prices_update_own"
on public.store_item_prices
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "prices_delete_own"
on public.store_item_prices
for delete
to authenticated
using (user_id = auth.uid());
