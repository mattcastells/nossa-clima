-- Iteracion 8c: variantes y presentaciones de materiales

alter table public.items
add column if not exists variant_label text,
add column if not exists presentation_quantity numeric(12,3),
add column if not exists presentation_unit text;

do $$
begin
  alter table public.items
  add constraint items_presentation_quantity_positive
  check (presentation_quantity is null or presentation_quantity > 0);
exception
  when duplicate_object then null;
end;
$$;

drop view if exists public.store_price_comparison;
drop view if exists public.cheapest_store_by_item;
drop view if exists public.latest_store_item_prices;
drop view if exists public.item_price_history;

create view public.item_price_history as
select
  p.id,
  p.user_id,
  p.store_id,
  s.name as store_name,
  p.item_id,
  i.name as item_name,
  i.category as item_category,
  i.variant_label as item_variant_label,
  i.presentation_quantity as item_presentation_quantity,
  i.presentation_unit as item_presentation_unit,
  i.unit as item_unit,
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

create view public.latest_store_item_prices as
select distinct on (p.store_id, p.item_id)
  p.id,
  p.user_id,
  p.store_id,
  s.name as store_name,
  p.item_id,
  i.name as item_name,
  i.category as item_category,
  i.variant_label as item_variant_label,
  i.presentation_quantity as item_presentation_quantity,
  i.presentation_unit as item_presentation_unit,
  i.unit as item_unit,
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

create view public.cheapest_store_by_item as
with ranked as (
  select
    l.*,
    row_number() over (partition by l.item_id order by l.price asc, l.observed_at desc) as rn
  from public.latest_store_item_prices l
)
select * from ranked where rn = 1;

create view public.store_price_comparison as
select
  l.user_id,
  l.item_id,
  l.item_name,
  l.item_category,
  l.item_variant_label,
  l.item_presentation_quantity,
  l.item_presentation_unit,
  l.item_unit,
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

grant select on public.item_price_history to authenticated;
grant select on public.latest_store_item_prices to authenticated;
grant select on public.cheapest_store_by_item to authenticated;
grant select on public.store_price_comparison to authenticated;
