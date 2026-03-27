-- Reset de datos de prueba manteniendo el catalogo de servicios.
-- Ejecutar manualmente en Supabase SQL Editor.
-- ADVERTENCIA: borra datos de todas las cuentas en estas tablas.
-- No toca auth.users ni profiles.

do $$
begin
  if to_regclass('public.appointments') is not null then
    execute 'delete from public.appointments';
  end if;

  if to_regclass('public.quote_material_items') is not null then
    execute 'delete from public.quote_material_items';
  end if;

  if to_regclass('public.quote_service_items') is not null then
    execute 'delete from public.quote_service_items';
  end if;

  if to_regclass('public.quotes') is not null then
    execute 'delete from public.quotes';
  end if;

  if to_regclass('public.store_item_measure_prices') is not null then
    execute 'delete from public.store_item_measure_prices';
  end if;

  if to_regclass('public.store_item_prices') is not null then
    execute 'delete from public.store_item_prices';
  end if;

  if to_regclass('public.item_measurements') is not null then
    execute 'delete from public.item_measurements';
  end if;

  if to_regclass('public.items') is not null then
    execute 'delete from public.items';
  end if;

  if to_regclass('public.stores') is not null then
    execute 'delete from public.stores';
  end if;
end $$;
