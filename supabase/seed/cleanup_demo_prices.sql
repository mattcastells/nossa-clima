-- Limpieza: saca los precios de las tiendas demo.
--
-- POR QUE
-- Las tiendas de prueba (Clima Center, Frio Sur, Refrimax) estaban archivadas,
-- asi que no se veian en la pantalla de Tiendas. Pero las vistas de precios
-- (`latest_store_item_prices`, `cheapest_store_by_item`, `store_price_comparison`)
-- no filtran por `archived_at`, y sus precios seguian apareciendo mezclados con
-- los del relevamiento real: un "Cano de cobre 1/4" a $5.200 en Refrimax
-- compitiendo con los precios de verdad.
--
-- QUE NO HACE
-- No borra las tiendas ni los trabajos. Las tres estan referenciadas por
-- `quote_material_items.source_store_id` de 7 trabajos demo, y 10 de esos 13
-- renglones no tienen `source_store_name_snapshot`: desvincularlos les sacaria
-- el origen del material. Quedan archivadas, que es invisible en la app.
--
-- Idempotente: correrlo de nuevo no hace nada.

begin;

-- Solo precios de tiendas archivadas y marcadas como demo. Las dos condiciones
-- importan: sin `archived_at` una tienda real con la palabra demo en las notas
-- perderia sus precios.
delete from public.store_item_prices p
using public.stores s
where p.store_id = s.id
  and s.archived_at is not null
  and s.notes = '[demo]';

commit;

-- Verificacion:
--   select count(*) from public.store_item_prices p
--   join public.stores s on s.id = p.store_id
--   where s.notes = '[demo]';   -- tiene que dar 0
