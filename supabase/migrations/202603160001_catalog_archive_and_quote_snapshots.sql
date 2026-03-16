-- Iteracion 8: archivado logico en catalogos + snapshots historicos de origen en materiales

alter table public.stores
add column if not exists archived_at timestamptz;

alter table public.items
add column if not exists archived_at timestamptz;

alter table public.services
add column if not exists archived_at timestamptz;

alter table public.quote_material_items
add column if not exists source_store_name_snapshot text;

alter table public.quote_material_items
disable trigger validate_quote_material_item_integrity_trigger;

update public.quote_material_items qmi
set source_store_name_snapshot = s.name
from public.stores s
where qmi.source_store_id = s.id
  and qmi.source_store_name_snapshot is null;

alter table public.quote_material_items
enable trigger validate_quote_material_item_integrity_trigger;

create index if not exists stores_user_archived_name_idx
  on public.stores(user_id, archived_at, name);

create index if not exists items_user_archived_name_idx
  on public.items(user_id, archived_at, name);

create index if not exists services_user_archived_name_idx
  on public.services(user_id, archived_at, name);
