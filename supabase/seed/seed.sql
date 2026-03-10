-- Replace UUID with an existing auth user UUID before running manually.
-- Example minimal seed per user.

insert into public.profiles (id, full_name)
values ('00000000-0000-0000-0000-000000000001', 'Tecnico Demo')
on conflict (id) do nothing;

insert into public.stores (id, user_id, name, address)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Frío Norte', 'Av. Central 123'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Clima Sur', 'Calle 9 456')
on conflict (id) do nothing;

insert into public.items (id, user_id, name, item_type, unit)
values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Gas R410A', 'material', 'kg'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Manifold', 'tool', 'unidad')
on conflict (id) do nothing;

insert into public.store_item_prices (user_id, store_id, item_id, price, currency, observed_at, source_type)
values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 120000, 'ARS', now() - interval '7 day', 'quote'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 115000, 'ARS', now() - interval '3 day', 'purchase')
on conflict do nothing;
