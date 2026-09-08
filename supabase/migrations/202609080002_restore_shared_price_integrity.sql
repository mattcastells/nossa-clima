-- Repara `validate_store_item_price_integrity`.
--
-- QUE PASO
-- `202603160003_shared_catalogs_and_audit.sql` convirtio stores e items en
-- catalogo compartido y redefinio esta funcion para validar por `archived_at`
-- en vez de por dueño. Pero `202603100005_remove_is_active.sql` tiene un
-- `create or replace` de la MISMA funcion con la version vieja, por dueño.
-- Como las migraciones de este repo se aplican a mano, alguien volvio a correr
-- la 100005 despues de la 160003 y la piso.
--
-- POR QUE IMPORTA
-- La base quedo contradiciendose a si misma:
--   - las policies de RLS son las compartidas (`items_select_shared`,
--     `prices_insert_shared`): cualquier usuario ve y cotiza cualquier material;
--   - el trigger exigia `items.user_id = auth.uid()`.
-- O sea que un tecnico que cargaba un precio sobre un material creado por otra
-- cuenta recibia "Item invalid for current user" sin ninguna razon visible en
-- la interfaz. Con el catalogo repartido entre dos cuentas
-- (nossaclima@gmail.com y gulincastellsmatias+uitest@gmail.com), era cuestion
-- de tiempo.
--
-- Esta migracion restaura la version de la 160003, que es la que el resto del
-- esquema y la app dan por cierta.
--
-- OJO: si algun dia hay que volver a correr la 100005, correr esta despues.

create or replace function public.validate_store_item_price_integrity()
returns trigger
language plpgsql
as $$
declare
  store_ok boolean;
  item_ok boolean;
begin
  -- Catalogo compartido: lo que importa es que exista y no este archivado,
  -- no de quien es.
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

  -- La observacion de precio si es de quien la carga.
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
