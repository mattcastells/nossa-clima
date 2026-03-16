-- Seed de pruebas para Nossa Clima
-- Requiere migraciones 202603100001..202603100006
-- Usa automaticamente el primer usuario disponible en auth.users.

do $$
declare
  v_user_id uuid;
begin
  select id
  into v_user_id
  from auth.users
  order by created_at asc
  limit 1;

  if v_user_id is null then
    raise exception 'No hay usuarios en auth.users. Crea un usuario y vuelve a correr el seed.';
  end if;

  -- En SQL Editor (role postgres) auth.uid() suele ser null.
  -- Seteamos claims para que los triggers de integridad funcionen.
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.profiles (id, full_name)
  values (v_user_id, 'Operador Nossa Clima')
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.stores (id, user_id, name, address, phone, notes)
  values
    ('81000000-0000-0000-0000-000000000001', v_user_id, 'Clima Norte', 'Av. Siempre Viva 123', '11-4000-1000', 'Proveedor principal'),
    ('81000000-0000-0000-0000-000000000002', v_user_id, 'Frio Express', 'Calle 25 456', '11-4000-2000', 'Entrega rapida')
  on conflict (id) do nothing;

  insert into public.items (id, user_id, name, item_type, category, description)
  values
    ('82000000-0000-0000-0000-000000000001', v_user_id, 'Tuberia cobre 1/4', 'material', 'Caneria', 'Rollo de caneria de cobre'),
    ('82000000-0000-0000-0000-000000000002', v_user_id, 'Gas R410A', 'material', 'Refrigerante', 'Carga de gas refrigerante')
  on conflict (id) do nothing;

  insert into public.store_item_prices (id, user_id, store_id, item_id, price, currency, observed_at, source_type, notes)
  values
    ('83000000-0000-0000-0000-000000000001', v_user_id, '81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 125000, 'ARS', now() - interval '2 day', 'manual_update', 'Precio de referencia'),
    ('83000000-0000-0000-0000-000000000002', v_user_id, '81000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', 98000, 'ARS', now() - interval '1 day', 'purchase', 'Compra reciente')
  on conflict (id) do nothing;

  insert into public.services (id, user_id, name, category, base_price, description, unit_type)
  values
    ('84000000-0000-0000-0000-000000000001', v_user_id, 'Instalacion split 3000fr', 'Instalacion', 180000, 'Instalacion standard', 'servicio'),
    ('84000000-0000-0000-0000-000000000002', v_user_id, 'Mantenimiento preventivo', 'Mantenimiento', 95000, 'Limpieza y chequeo general', 'servicio')
  on conflict (id) do nothing;

  insert into public.service_categories (user_id, name)
  values
    (v_user_id, 'Instalacion'),
    (v_user_id, 'Mantenimiento')
  on conflict (user_id, name) do nothing;

  insert into public.quotes (id, user_id, client_name, client_phone, title, status, notes)
  values
    ('85000000-0000-0000-0000-000000000001', v_user_id, 'Cliente Demo', '11-5555-5555', 'Instalacion equipo living', 'pending', 'Visita acordada por la tarde')
  on conflict (id) do nothing;

  insert into public.quote_service_items (id, quote_id, user_id, service_id, service_name_snapshot, quantity, unit_price, notes)
  values
    ('86000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', v_user_id, '84000000-0000-0000-0000-000000000001', 'Instalacion split 3000fr', 1, 180000, 'Incluye puesta en marcha')
  on conflict (id) do nothing;

  insert into public.quote_material_items (id, quote_id, user_id, item_id, item_name_snapshot, quantity, unit_price, source_store_id, source_store_name_snapshot, notes)
  values
    ('87000000-0000-0000-0000-000000000001', '85000000-0000-0000-0000-000000000001', v_user_id, '82000000-0000-0000-0000-000000000002', 'Gas R410A', 1, 98000, '81000000-0000-0000-0000-000000000002', 'Frio Express', 'Carga inicial')
  on conflict (id) do nothing;

  insert into public.appointments (id, user_id, quote_id, title, notes, scheduled_for, starts_at, status)
  values
    ('88000000-0000-0000-0000-000000000001', v_user_id, '85000000-0000-0000-0000-000000000001', 'Cliente Demo - Instalacion equipo living', 'Turno confirmado', current_date + interval '1 day', '15:00', 'scheduled')
  on conflict (id) do nothing;
end $$;
