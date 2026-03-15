-- Iteracion 7: margen global por trabajo + total de materiales con margen aplicado

alter table public.quotes
add column if not exists default_material_margin_percent numeric(12,2)
check (default_material_margin_percent >= 0);

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

  select exists (
    select 1 from public.items i
    where i.id = new.item_id and i.user_id = auth.uid()
  ) into item_ok;

  if not item_ok then
    raise exception 'Item invalid for current user';
  end if;

  if new.source_store_id is not null then
    select exists (
      select 1 from public.stores s
      where s.id = new.source_store_id and s.user_id = auth.uid()
    ) into store_ok;

    if not store_ok then
      raise exception 'Source store invalid for current user';
    end if;
  end if;

  effective_margin = coalesce(new.margin_percent, quote_default_margin, 0);
  new.total_price = round((new.quantity * new.unit_price * (1 + effective_margin / 100))::numeric, 2);

  return new;
end;
$$;

alter table public.quote_material_items disable trigger validate_quote_material_item_integrity_trigger;

update public.quote_material_items qmi
set total_price = round(
  (
    qmi.quantity
    * qmi.unit_price
    * (1 + coalesce(qmi.margin_percent, q.default_material_margin_percent, 0) / 100)
  )::numeric,
  2
)
from public.quotes q
where q.id = qmi.quote_id;

alter table public.quote_material_items enable trigger validate_quote_material_item_integrity_trigger;

do $$
declare
  quote_row record;
begin
  for quote_row in
    select id from public.quotes
  loop
    perform public.recalculate_quote_totals(quote_row.id);
  end loop;
end $$;
