-- Relevamiento automatizado de proveedores (discovery + scraping mensual).
--
-- Tres cosas:
--   1. Procedencia en los catalogos compartidos: de donde salio cada fila y
--      que valores escribio el scraper la ultima vez (scraped_snapshot), que es
--      la base del merge a tres vias contra lo que edito una persona.
--   2. Tablas operativas del pipeline: fuentes, candidatos y corridas.
--   3. Deduplicacion real: dominio canonico unico en stores, y huella unica
--      por observacion de precio para que reprocesar el mismo sitio no duplique.
--
-- Idempotente: se puede correr varias veces.

-- ---------------------------------------------------------------------------
-- 1. Enum de origen de precio
-- ---------------------------------------------------------------------------

-- 'scraper' se suma a purchase/manual_update/quote/other.
--
-- OJO CON EL ORDEN: Postgres deja agregar un valor de enum dentro de una
-- transaccion, pero no deja usarlo hasta que esa transaccion commitea. Esta
-- migracion no lo usa, asi que corre bien sola. El SQL que genera el
-- relevamiento SI lo usa: hay que correrlo despues, aparte, no pegado a esto.
alter type public.source_type add value if not exists 'scraper';

-- ---------------------------------------------------------------------------
-- 2. Procedencia en stores
-- ---------------------------------------------------------------------------

-- Semantica de las columnas de procedencia, para que no se confundan:
--
--   source / source_type  ORIGEN DE LA FILA. 'automated' solo si la fila la
--                         creo el relevamiento al aprobar un candidato. Una
--                         tienda cargada a mano sigue siendo 'manual' aunque
--                         el scraper le complete el mail.
--   last_scraped_at       ultima vez que el relevamiento la miro.
--   source_url            de que pagina salieron los datos.
--   scraped_snapshot      QUE CAMPOS son del scraper y con que valor. Es la
--                         trazabilidad fina y la base del merge a tres vias.
--
-- "Todo lo que toco el relevamiento" = last_scraped_at is not null.
-- "Todo lo que creo el relevamiento"  = source_type = 'automated'.

alter table public.stores add column if not exists website text;
alter table public.stores add column if not exists email text;
alter table public.stores add column if not exists canonical_domain text;
alter table public.stores add column if not exists source text not null default 'manual';
alter table public.stores add column if not exists source_type text not null default 'manual';
alter table public.stores add column if not exists source_url text;
alter table public.stores add column if not exists last_scraped_at timestamptz;
-- Ultimos valores que escribio el scraper. Es la "base" del merge a tres vias:
-- si el valor actual difiere de este snapshot, lo edito una persona y no se pisa.
alter table public.stores add column if not exists scraped_snapshot jsonb;

alter table public.stores drop constraint if exists stores_source_type_check;
alter table public.stores
  add constraint stores_source_type_check
  check (source_type in ('manual', 'automated'));

-- Deduplicacion dura: un dominio, una tienda activa.
create unique index if not exists stores_canonical_domain_key
  on public.stores(canonical_domain)
  where canonical_domain is not null and archived_at is null;

-- ---------------------------------------------------------------------------
-- 3. Procedencia en items
-- ---------------------------------------------------------------------------

alter table public.items add column if not exists source text not null default 'manual';
alter table public.items add column if not exists source_type text not null default 'manual';
alter table public.items add column if not exists source_url text;
alter table public.items add column if not exists last_scraped_at timestamptz;
alter table public.items add column if not exists scraped_snapshot jsonb;

alter table public.items drop constraint if exists items_source_type_check;
alter table public.items
  add constraint items_source_type_check
  check (source_type in ('manual', 'automated'));

-- ---------------------------------------------------------------------------
-- 4. Trazabilidad e idempotencia en las observaciones de precio
-- ---------------------------------------------------------------------------

alter table public.store_item_prices add column if not exists source_url text;
-- Huella del hecho observado: dominio + producto + precio + moneda.
-- Reprocesar el mismo sitio con el mismo precio no inserta de nuevo;
-- si el precio cambio, la huella cambia y entra una observacion nueva.
alter table public.store_item_prices add column if not exists external_ref text;

create unique index if not exists store_item_prices_external_ref_key
  on public.store_item_prices(external_ref)
  where external_ref is not null;

-- ---------------------------------------------------------------------------
-- 5. Corridas del relevamiento
-- ---------------------------------------------------------------------------

create table if not exists public.supplier_survey_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',
  mode text not null default 'full',
  stats jsonb not null default '{}'::jsonb,
  config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.supplier_survey_runs drop constraint if exists supplier_survey_runs_status_check;
alter table public.supplier_survey_runs
  add constraint supplier_survey_runs_status_check
  check (status in ('running', 'completed', 'failed'));

-- `mode` distingue una corrida del scraper ('full', 'update', 'discover') de la
-- carga de una planilla ('import'). No lleva check: es una etiqueta, y limitarla
-- obligaria a migrar la base cada vez que se agrega una forma de relevar.

create index if not exists supplier_survey_runs_started_idx
  on public.supplier_survey_runs(started_at desc);

-- ---------------------------------------------------------------------------
-- 6. Fuentes: el registro de sitios que relevamos
-- ---------------------------------------------------------------------------

create table if not exists public.supplier_sources (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  url text not null,
  canonical_domain text not null,
  discovery_method text not null default 'seed',
  status text not null default 'active',
  robots_allowed boolean,
  http_etag text,
  http_last_modified text,
  content_hash text,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  last_http_status integer,
  failure_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists supplier_sources_domain_key
  on public.supplier_sources(canonical_domain);

alter table public.supplier_sources drop constraint if exists supplier_sources_status_check;
alter table public.supplier_sources
  add constraint supplier_sources_status_check
  check (status in ('active', 'dead', 'irrelevant', 'blocked', 'paused'));

alter table public.supplier_sources drop constraint if exists supplier_sources_method_check;
alter table public.supplier_sources
  add constraint supplier_sources_method_check
  check (discovery_method in ('seed', 'search', 'directory', 'manual'));

create index if not exists supplier_sources_status_idx
  on public.supplier_sources(status, last_fetched_at);

drop trigger if exists supplier_sources_set_updated_at on public.supplier_sources;
create trigger supplier_sources_set_updated_at
  before update on public.supplier_sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Candidatos de empresa (staging)
-- ---------------------------------------------------------------------------
-- Nada scrapeado entra directo a stores: stores es el catalogo compartido que
-- el tecnico ve al elegir el origen de un material. Primero pasa por aca.

create table if not exists public.supplier_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.supplier_survey_runs(id) on delete set null,
  source_id uuid references public.supplier_sources(id) on delete set null,
  source_url text not null,
  canonical_domain text not null,
  fingerprint text not null,
  name text,
  address text,
  phone text,
  email text,
  website text,
  description text,
  -- Texto libre del relevamiento (zona, envios, observaciones). Al aprobar el
  -- candidato pasa a `stores.notes`, que es el campo que lee el tecnico.
  notes text,
  categories text[] not null default '{}',
  relevance_score numeric(5,2),
  match_store_id uuid references public.stores(id) on delete set null,
  match_confidence numeric(5,2),
  match_reason text,
  decision text not null default 'needs_review',
  diff jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  scraped_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_candidates drop constraint if exists supplier_candidates_decision_check;
alter table public.supplier_candidates
  add constraint supplier_candidates_decision_check
  check (decision in ('new', 'update', 'duplicate', 'irrelevant', 'needs_review', 'applied', 'discarded'));

-- Un candidato por huella y por corrida: reprocesar la misma corrida no duplica.
create unique index if not exists supplier_candidates_run_fingerprint_key
  on public.supplier_candidates(run_id, fingerprint);

create index if not exists supplier_candidates_decision_idx
  on public.supplier_candidates(decision, scraped_at desc);

create index if not exists supplier_candidates_domain_idx
  on public.supplier_candidates(canonical_domain);

drop trigger if exists supplier_candidates_set_updated_at on public.supplier_candidates;
create trigger supplier_candidates_set_updated_at
  before update on public.supplier_candidates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Candidatos de producto y precio (staging)
-- ---------------------------------------------------------------------------

create table if not exists public.supplier_product_candidates (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.supplier_survey_runs(id) on delete set null,
  source_id uuid references public.supplier_sources(id) on delete set null,
  candidate_id uuid references public.supplier_candidates(id) on delete cascade,
  store_id uuid references public.stores(id) on delete set null,
  source_url text not null,
  canonical_domain text not null,
  external_ref text not null,
  name text not null,
  brand text,
  sku text,
  category text,
  unit text,
  presentation_quantity numeric(12,3),
  presentation_unit text,
  price numeric(12,2),
  currency text not null default 'ARS',
  availability text,
  matched_item_id uuid references public.items(id) on delete set null,
  match_confidence numeric(5,2),
  match_reason text,
  decision text not null default 'needs_review',
  raw jsonb not null default '{}'::jsonb,
  scraped_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.supplier_product_candidates drop constraint if exists supplier_product_candidates_decision_check;
alter table public.supplier_product_candidates
  add constraint supplier_product_candidates_decision_check
  check (decision in ('new', 'update', 'duplicate', 'irrelevant', 'needs_review', 'applied', 'discarded'));

create unique index if not exists supplier_product_candidates_run_ref_key
  on public.supplier_product_candidates(run_id, external_ref);

create index if not exists supplier_product_candidates_decision_idx
  on public.supplier_product_candidates(decision, scraped_at desc);

drop trigger if exists supplier_product_candidates_set_updated_at on public.supplier_product_candidates;
create trigger supplier_product_candidates_set_updated_at
  before update on public.supplier_product_candidates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------------
-- Estas tablas acompanan a stores/items, que son catalogo compartido
-- (202603160003_shared_catalogs_and_audit.sql), asi que siguen ese patron:
-- cualquier usuario autenticado lee y escribe; el anonimo no ve nada.

alter table public.supplier_survey_runs enable row level security;
alter table public.supplier_sources enable row level security;
alter table public.supplier_candidates enable row level security;
alter table public.supplier_product_candidates enable row level security;

drop policy if exists "supplier_survey_runs_select_shared" on public.supplier_survey_runs;
drop policy if exists "supplier_survey_runs_insert_shared" on public.supplier_survey_runs;
drop policy if exists "supplier_survey_runs_update_shared" on public.supplier_survey_runs;

create policy "supplier_survey_runs_select_shared" on public.supplier_survey_runs
  for select to authenticated using (true);
create policy "supplier_survey_runs_insert_shared" on public.supplier_survey_runs
  for insert to authenticated with check (auth.uid() is not null);
create policy "supplier_survey_runs_update_shared" on public.supplier_survey_runs
  for update to authenticated using (true) with check (true);

drop policy if exists "supplier_sources_select_shared" on public.supplier_sources;
drop policy if exists "supplier_sources_insert_shared" on public.supplier_sources;
drop policy if exists "supplier_sources_update_shared" on public.supplier_sources;

create policy "supplier_sources_select_shared" on public.supplier_sources
  for select to authenticated using (true);
create policy "supplier_sources_insert_shared" on public.supplier_sources
  for insert to authenticated with check (auth.uid() is not null);
create policy "supplier_sources_update_shared" on public.supplier_sources
  for update to authenticated using (true) with check (true);

drop policy if exists "supplier_candidates_select_shared" on public.supplier_candidates;
drop policy if exists "supplier_candidates_insert_shared" on public.supplier_candidates;
drop policy if exists "supplier_candidates_update_shared" on public.supplier_candidates;

create policy "supplier_candidates_select_shared" on public.supplier_candidates
  for select to authenticated using (true);
create policy "supplier_candidates_insert_shared" on public.supplier_candidates
  for insert to authenticated with check (auth.uid() is not null);
create policy "supplier_candidates_update_shared" on public.supplier_candidates
  for update to authenticated using (true) with check (true);

drop policy if exists "supplier_product_candidates_select_shared" on public.supplier_product_candidates;
drop policy if exists "supplier_product_candidates_insert_shared" on public.supplier_product_candidates;
drop policy if exists "supplier_product_candidates_update_shared" on public.supplier_product_candidates;

create policy "supplier_product_candidates_select_shared" on public.supplier_product_candidates
  for select to authenticated using (true);
create policy "supplier_product_candidates_insert_shared" on public.supplier_product_candidates
  for insert to authenticated with check (auth.uid() is not null);
create policy "supplier_product_candidates_update_shared" on public.supplier_product_candidates
  for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- 10. Vista de revision
-- ---------------------------------------------------------------------------
-- Lo unico que hay que mirar despues de cada corrida: lo que necesita una
-- decision humana. Las actualizaciones de tiendas conocidas NO entran: ya las
-- aplico el SQL y estan listadas en el reporte. Si entraran, la cola se
-- llenaria todos los meses con filas que nadie tiene que mirar.

create or replace view public.supplier_review_queue as
select
  c.id,
  c.run_id,
  c.decision,
  c.canonical_domain,
  c.source_url,
  c.name,
  c.address,
  c.phone,
  c.email,
  c.website,
  c.relevance_score,
  c.match_store_id,
  s.name as match_store_name,
  c.match_confidence,
  c.match_reason,
  c.diff,
  c.scraped_at
from public.supplier_candidates c
left join public.stores s on s.id = c.match_store_id
where c.decision in ('new', 'needs_review')
  and c.reviewed_at is null;

alter view public.supplier_review_queue set (security_invoker = true);

-- ---------------------------------------------------------------------------
-- 11. Aprobar y descartar candidatos
-- ---------------------------------------------------------------------------
-- La promocion de un candidato a `stores` es el unico camino por el que una
-- empresa relevada entra al catalogo compartido, y es siempre una decision
-- humana. Va como funcion para que sea una sola llamada, idempotente y con el
-- etiquetado de origen correcto, en vez de un INSERT copiado a mano.

create or replace function public.promote_supplier_candidate(p_candidate_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_candidate public.supplier_candidates%rowtype;
  v_store_id uuid;
begin
  select * into v_candidate from public.supplier_candidates where id = p_candidate_id;

  if not found then
    raise exception 'No existe el candidato %', p_candidate_id;
  end if;

  if v_candidate.name is null or length(trim(v_candidate.name)) = 0 then
    raise exception 'El candidato % no tiene nombre; no se puede promover', p_candidate_id;
  end if;

  -- Idempotencia: si el dominio ya es una tienda activa, se enriquece esa fila
  -- en vez de crear una segunda. Correr esto dos veces no duplica nada.
  select id into v_store_id
  from public.stores
  where canonical_domain = v_candidate.canonical_domain
    and archived_at is null
  limit 1;

  if v_store_id is null then
    v_store_id := v_candidate.match_store_id;
  end if;

  if v_store_id is null then
    insert into public.stores (
      name, address, phone, email, website, canonical_domain, description, notes,
      source, source_type, source_url, last_scraped_at, scraped_snapshot
    )
    values (
      v_candidate.name, v_candidate.address, v_candidate.phone, v_candidate.email,
      v_candidate.website, v_candidate.canonical_domain, v_candidate.description, v_candidate.notes,
      'air_conditioning_scraper', 'automated', v_candidate.source_url, v_candidate.scraped_at,
      jsonb_strip_nulls(jsonb_build_object(
        'name', v_candidate.name,
        'address', v_candidate.address,
        'phone', v_candidate.phone,
        'email', v_candidate.email,
        'website', v_candidate.website,
        'canonical_domain', v_candidate.canonical_domain
      ))
    )
    returning id into v_store_id;
  else
    -- Tienda existente: solo se completan huecos. Nunca se pisa lo cargado.
    -- `description` y `notes` incluidos: si el tecnico ya escribio ahi el
    -- horario o el celular del vendedor, eso queda.
    update public.stores set
      address = coalesce(address, v_candidate.address),
      phone = coalesce(phone, v_candidate.phone),
      email = coalesce(email, v_candidate.email),
      website = coalesce(website, v_candidate.website),
      canonical_domain = coalesce(canonical_domain, v_candidate.canonical_domain),
      description = coalesce(description, v_candidate.description),
      notes = coalesce(notes, v_candidate.notes),
      source_url = v_candidate.source_url,
      last_scraped_at = v_candidate.scraped_at,
      scraped_snapshot = coalesce(scraped_snapshot, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'address', v_candidate.address,
        'phone', v_candidate.phone,
        'email', v_candidate.email,
        'website', v_candidate.website,
        'canonical_domain', v_candidate.canonical_domain
      ))
    where id = v_store_id;
  end if;

  update public.supplier_candidates set
    decision = 'applied',
    match_store_id = v_store_id,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_candidate_id;

  -- Los productos relevados del mismo dominio quedan atados a la tienda.
  update public.supplier_product_candidates set
    store_id = v_store_id
  where canonical_domain = v_candidate.canonical_domain
    and store_id is null;

  return v_store_id;
end;
$$;

create or replace function public.discard_supplier_candidate(p_candidate_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker
as $$
begin
  update public.supplier_candidates set
    decision = 'discarded',
    match_reason = coalesce(p_reason, match_reason),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where id = p_candidate_id;

  if not found then
    raise exception 'No existe el candidato %', p_candidate_id;
  end if;
end;
$$;

grant execute on function public.promote_supplier_candidate(uuid) to authenticated;
grant execute on function public.discard_supplier_candidate(uuid, text) to authenticated;
