-- Feedback de usuarios (2026-08): el informe imprimia "1 mt" para un capacitor.
--
-- Causa: el alta de material del catalogo guardaba items.unit = 'mt' fijo (el
-- formulario no pedia unidad) y las lineas de trabajo copian la unidad del item.
-- En el codigo ya se corrigio: el formulario tiene un campo "Unidad" opcional
-- ("mt", "kg", "un"), vacio = sin unidad, y no se asume 'mt' en ningun lado.
--
-- Esta migracion es un arreglo de DATOS, no de esquema, y va por nombre porque
-- en el catalogo real conviven dos casos que la base no distingue:
--
--   * items que SI se venden por metro (cables, canos, aislantes, cablecanal,
--     manguera): el 'mt' quedo bien aunque haya venido del default. Se dejan.
--   * items que NO (capacitores, tomacorrientes, mensulas, curvas, grampas,
--     sellafugas, cintas, gas, varilla, items de prueba): se les saca la unidad.
--   * items cuyo nombre dice "(kg)" (cobre, recargas de gas): pasan a 'kg'.
--
-- Despues se propaga a las lineas de trabajo SIN medida, para que los informes
-- ya emitidos se regeneren bien (ej. el capacitor de Ana). Las lineas con
-- medida conservan la unidad de la medida (esas si son por metro).
--
-- Los items que queden mal se corrigen desde la app, en el campo Unidad.
-- Idempotente: se puede correr mas de una vez.

-- 1) Items que no se miden en metros: sin unidad.
update public.items
set unit = null
where unit = 'mt'
  and name in (
    'Capacitor 25mf',
    'Capacitor 35mf',
    'Cinta con adhesivo',
    'Cinta sin adhesivo',
    'Curva cablecanal 100x50',
    'Curva caño rígido Sica',
    'Grampa caño rígido Sica',
    'Garrafa 410 de 2,8kg',
    'Gas R410',
    'Ménsula 42',
    'Ménsula 49',
    'Sellafugas K11',
    'Tomacorriente 10A',
    'Tomacorriente 20A',
    'Varilla de cobre',
    'Fff',
    'Fghhfg',
    'Mati'
  );

-- 2) Items que se cuentan por kilo (lo dice el nombre).
update public.items
set unit = 'kg'
where unit = 'mt'
  and name in (
    'Cobre (kg)',
    'Recarga R-22 (kg)',
    'Recarga R-410 (kg)'
  );

-- 3) Medida "Unidad" del capacitor archivado: la creo el usuario como
--    atajo para decir "se cuenta por unidad" (no habia campo Unidad). Ninguna
--    linea la usa, y mientras este activa el trigger de integridad exige medida
--    en las lineas de ese item, lo que bloquea el paso 4 y cualquier edicion de
--    la linea de Ana desde la app. Se archiva (reversible), no se borra.
update public.item_measurements m
set archived_at = now()
from public.items i
where i.id = m.item_id
  and i.name = 'Capacitor 35mf'
  and m.label = 'Unidad'
  and m.archived_at is null
  and not exists (select 1 from public.quote_material_items q where q.item_measurement_id = m.id);

-- 4) Las lineas de trabajo sin medida siguen al item del catalogo.
update public.quote_material_items q
set unit = i.unit
from public.items i
where i.id = q.item_id
  and q.item_measurement_id is null
  and q.unit is distinct from i.unit;
