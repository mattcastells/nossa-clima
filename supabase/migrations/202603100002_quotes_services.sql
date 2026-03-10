-- Iteración 2: services + quotes

-- Enums
create type public.quote_status as enum ('draft', 'sent', 'approved', 'rejected');

-- Tables
create table public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  category text,
  base_price numeric(12,2) not null default 0 check (base_price >= 0),
  unit_type text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null check (char_length(trim(client_name)) > 0),
  client_phone text,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  status public.quote_status not null default 'draft',
  notes text,
  subtotal_materials numeric(12,2) not null default 0 check (subtotal_materials >= 0),
  subtotal_services numeric(12,2) not null default 0 check (subtotal_services >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_material_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete restrict,
  item_name_snapshot text not null check (char_length(trim(item_name_snapshot)) > 0),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit text,
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  margin_percent numeric(12,2) check (margin_percent >= 0),
  total_price numeric(12,2) not null default 0 check (total_price >= 0),
  source_store_id uuid references public.stores(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quote_service_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name_snapshot text not null check (char_length(trim(service_name_snapshot)) > 0),
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  total_price numeric(12,2) not null default 0 check (total_price >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Triggers: updated_at + user defaults
create trigger services_set_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger quotes_set_updated_at before update on public.quotes for each row execute function public.set_updated_at();
create trigger quote_material_items_set_updated_at before update on public.quote_material_items for each row execute function public.set_updated_at();
create trigger quote_service_items_set_updated_at before update on public.quote_service_items for each row execute function public.set_updated_at();

create trigger services_set_user_id before insert on public.services for each row execute function public.set_user_id_default();
create trigger quotes_set_user_id before insert on public.quotes for each row execute function public.set_user_id_default();
create trigger quote_material_items_set_user_id before insert on public.quote_material_items for each row execute function public.set_user_id_default();
create trigger quote_service_items_set_user_id before insert on public.quote_service_items for each row execute function public.set_user_id_default();

-- Line totals + integrity validations
create or replace function public.validate_quote_material_item_integrity()
returns trigger
language plpgsql
as $$
declare
  quote_owner uuid;
  item_ok boolean;
  store_ok boolean;
begin
  select q.user_id into quote_owner
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
    where i.id = new.item_id and i.user_id = auth.uid() and i.is_active = true
  ) into item_ok;

  if not item_ok then
    raise exception 'Item invalid/inactive for current user';
  end if;

  if new.source_store_id is not null then
    select exists (
      select 1 from public.stores s
      where s.id = new.source_store_id and s.user_id = auth.uid() and s.is_active = true
    ) into store_ok;

    if not store_ok then
      raise exception 'Source store invalid/inactive for current user';
    end if;
  end if;

  new.total_price = round((new.quantity * new.unit_price)::numeric, 2);

  return new;
end;
$$;

create or replace function public.validate_quote_service_item_integrity()
returns trigger
language plpgsql
as $$
declare
  quote_owner uuid;
  service_ok boolean;
begin
  select q.user_id into quote_owner
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
    select 1 from public.services s
    where s.id = new.service_id and s.user_id = auth.uid() and s.is_active = true
  ) into service_ok;

  if not service_ok then
    raise exception 'Service invalid/inactive for current user';
  end if;

  new.total_price = round((new.quantity * new.unit_price)::numeric, 2);

  return new;
end;
$$;

create trigger validate_quote_material_item_integrity_trigger
before insert or update on public.quote_material_items
for each row execute function public.validate_quote_material_item_integrity();

create trigger validate_quote_service_item_integrity_trigger
before insert or update on public.quote_service_items
for each row execute function public.validate_quote_service_item_integrity();

-- Quote totals recalculation
create or replace function public.recalculate_quote_totals(target_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  materials_total numeric(12,2);
  services_total numeric(12,2);
begin
  select coalesce(sum(total_price), 0)::numeric(12,2)
  into materials_total
  from public.quote_material_items
  where quote_id = target_quote_id;

  select coalesce(sum(total_price), 0)::numeric(12,2)
  into services_total
  from public.quote_service_items
  where quote_id = target_quote_id;

  update public.quotes
  set
    subtotal_materials = materials_total,
    subtotal_services = services_total,
    total = round((materials_total + services_total)::numeric, 2),
    updated_at = now()
  where id = target_quote_id;
end;
$$;

create or replace function public.quote_totals_recalc_trigger()
returns trigger
language plpgsql
as $$
declare
  affected_quote_id uuid;
begin
  affected_quote_id = coalesce(new.quote_id, old.quote_id);
  perform public.recalculate_quote_totals(affected_quote_id);
  return coalesce(new, old);
end;
$$;

create trigger quote_material_items_recalc_totals_trigger
after insert or update or delete on public.quote_material_items
for each row execute function public.quote_totals_recalc_trigger();

create trigger quote_service_items_recalc_totals_trigger
after insert or update or delete on public.quote_service_items
for each row execute function public.quote_totals_recalc_trigger();

-- Useful indexes
create index services_user_active_name_idx on public.services(user_id, is_active, name);
create index quotes_user_status_created_idx on public.quotes(user_id, status, created_at desc);
create index quote_material_items_quote_idx on public.quote_material_items(quote_id, created_at);
create index quote_material_items_user_item_idx on public.quote_material_items(user_id, item_id);
create index quote_service_items_quote_idx on public.quote_service_items(quote_id, created_at);
create index quote_service_items_user_service_idx on public.quote_service_items(user_id, service_id);

-- RLS
alter table public.services enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_material_items enable row level security;
alter table public.quote_service_items enable row level security;

create policy "services_select_own" on public.services for select using (user_id = auth.uid());
create policy "services_insert_own" on public.services for insert with check (user_id = auth.uid());
create policy "services_update_own" on public.services for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "services_delete_own" on public.services for delete using (user_id = auth.uid());

create policy "quotes_select_own" on public.quotes for select using (user_id = auth.uid());
create policy "quotes_insert_own" on public.quotes for insert with check (user_id = auth.uid());
create policy "quotes_update_own" on public.quotes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quotes_delete_own" on public.quotes for delete using (user_id = auth.uid());

create policy "quote_material_items_select_own" on public.quote_material_items for select using (user_id = auth.uid());
create policy "quote_material_items_insert_own" on public.quote_material_items for insert with check (user_id = auth.uid());
create policy "quote_material_items_update_own" on public.quote_material_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quote_material_items_delete_own" on public.quote_material_items for delete using (user_id = auth.uid());

create policy "quote_service_items_select_own" on public.quote_service_items for select using (user_id = auth.uid());
create policy "quote_service_items_insert_own" on public.quote_service_items for insert with check (user_id = auth.uid());
create policy "quote_service_items_update_own" on public.quote_service_items for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quote_service_items_delete_own" on public.quote_service_items for delete using (user_id = auth.uid());
