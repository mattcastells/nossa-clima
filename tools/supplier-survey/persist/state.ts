/**
 * Lectura del estado actual de la base.
 *
 * Se lee TODO antes de decidir nada. El pipeline no consulta la base mientras
 * scrapea: asi una corrida es reproducible y se puede trabajar contra un
 * snapshot en disco, sin credenciales y sin red.
 *
 * Lectura con la anon key y login de usuario, igual que el job de keep-alive.
 * La service_role no entra a este repo.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { SupabaseCredentials } from '../config.ts';
import type { Logger } from '../core/logger.ts';
import type { DatabaseState, ItemState, StoreState } from '../core/types.ts';

interface StoreRow {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email?: string | null;
  website?: string | null;
  notes: string | null;
  canonical_domain?: string | null;
  source?: string | null;
  source_type?: string | null;
  archived_at: string | null;
  scraped_snapshot?: Record<string, string | null> | null;
}

interface ItemRow {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  category: string | null;
  unit: string | null;
  variant_label?: string | null;
  archived_at: string | null;
}

const toStoreState = (row: StoreRow): StoreState => ({
  id: row.id,
  name: row.name,
  description: row.description,
  address: row.address,
  phone: row.phone,
  email: row.email ?? null,
  website: row.website ?? null,
  notes: row.notes,
  canonicalDomain: row.canonical_domain ?? null,
  source: row.source ?? 'manual',
  sourceType: row.source_type ?? 'manual',
  archivedAt: row.archived_at,
  scrapedSnapshot: row.scraped_snapshot ?? null,
});

const toItemState = (row: ItemRow): ItemState => ({
  id: row.id,
  name: row.name,
  brand: row.brand,
  sku: row.sku,
  category: row.category,
  unit: row.unit,
  variantLabel: row.variant_label ?? null,
  archivedAt: row.archived_at,
});

/**
 * Detecta el error de columna faltante de PostgREST, igual que
 * `src/services/supabaseCompatibility.ts`. La migracion se aplica a mano, asi
 * que el pipeline tiene que poder correr contra un esquema viejo y avisar.
 */
const isMissingColumnError = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (error.code && ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(error.code)) return true;
  const text = (error.message ?? '').toLowerCase();
  return text.includes('does not exist') || text.includes('schema cache');
};

export const connectSupabase = async (
  credentials: SupabaseCredentials,
  logger: Logger,
): Promise<SupabaseClient | null> => {
  const client = createClient(credentials.url, credentials.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    logger.error(`no pude iniciar sesion en Supabase: ${error.message}`);
    return null;
  }

  return client;
};

export interface LoadStateResult {
  state: DatabaseState;
  /** true si la base todavia no tiene la migracion del relevamiento. */
  migrationMissing: boolean;
}

export const loadStateFromSupabase = async (client: SupabaseClient, logger: Logger): Promise<LoadStateResult> => {
  let migrationMissing = false;

  const storeColumns =
    'id, name, description, address, phone, email, website, notes, canonical_domain, source, source_type, archived_at, scraped_snapshot';

  let storeRows: StoreRow[] = [];
  const stores = await client.from('stores').select(storeColumns);

  if (stores.error) {
    if (!isMissingColumnError(stores.error)) throw new Error(`stores: ${stores.error.message}`);

    // Esquema viejo: leemos lo que existe y avisamos.
    migrationMissing = true;
    logger.warn('la base no tiene las columnas del relevamiento: falta aplicar la migracion 202609080001');

    const fallback = await client.from('stores').select('id, name, description, address, phone, notes, archived_at');
    if (fallback.error) throw new Error(`stores: ${fallback.error.message}`);
    storeRows = (fallback.data ?? []) as StoreRow[];
  } else {
    storeRows = (stores.data ?? []) as StoreRow[];
  }

  const items = await client.from('items').select('id, name, brand, sku, category, unit, variant_label, archived_at');
  if (items.error) throw new Error(`items: ${items.error.message}`);

  const priceRefs = new Set<string>();
  if (!migrationMissing) {
    const prices = await client.from('store_item_prices').select('external_ref').not('external_ref', 'is', null);
    if (prices.error && !isMissingColumnError(prices.error)) throw new Error(`store_item_prices: ${prices.error.message}`);
    for (const row of (prices.data ?? []) as Array<{ external_ref: string | null }>) {
      if (row.external_ref) priceRefs.add(row.external_ref);
    }
  }

  const knownDomains = new Set<string>();
  for (const row of storeRows) {
    if (row.canonical_domain) knownDomains.add(row.canonical_domain);
  }

  const dismissedDomains = new Set<string>();

  if (!migrationMissing) {
    const sources = await client.from('supplier_sources').select('canonical_domain');
    if (sources.error) {
      if (!isMissingColumnError(sources.error)) throw new Error(`supplier_sources: ${sources.error.message}`);
      migrationMissing = true;
    }
    for (const row of (sources.data ?? []) as Array<{ canonical_domain: string }>) {
      knownDomains.add(row.canonical_domain);
    }
  }

  if (!migrationMissing) {
    // Lo que ya se decidio no vuelve a preguntarse.
    const dismissed = await client
      .from('supplier_candidates')
      .select('canonical_domain')
      .in('decision', ['discarded', 'irrelevant']);

    if (dismissed.error && !isMissingColumnError(dismissed.error)) {
      throw new Error(`supplier_candidates: ${dismissed.error.message}`);
    }

    for (const row of (dismissed.data ?? []) as Array<{ canonical_domain: string }>) {
      dismissedDomains.add(row.canonical_domain);
    }
  }

  return {
    state: {
      stores: storeRows.map(toStoreState),
      items: ((items.data ?? []) as ItemRow[]).map(toItemState),
      priceRefs,
      knownDomains,
      dismissedDomains,
      origin: 'supabase',
    },
    migrationMissing,
  };
};

/** Snapshot serializable: `Set` no sobrevive a JSON. */
interface SerializedState {
  stores: StoreState[];
  items: ItemState[];
  priceRefs: string[];
  knownDomains: string[];
  dismissedDomains: string[];
  savedAt: string;
}

export const saveStateSnapshot = async (state: DatabaseState, filePath: string): Promise<void> => {
  const payload: SerializedState = {
    stores: state.stores,
    items: state.items,
    priceRefs: [...state.priceRefs],
    knownDomains: [...state.knownDomains],
    dismissedDomains: [...state.dismissedDomains],
    savedAt: new Date().toISOString(),
  };

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
};

export const loadStateSnapshot = async (filePath: string): Promise<DatabaseState> => {
  const content = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(content) as Partial<SerializedState>;

  return {
    stores: parsed.stores ?? [],
    items: parsed.items ?? [],
    priceRefs: new Set(parsed.priceRefs ?? []),
    knownDomains: new Set(parsed.knownDomains ?? []),
    dismissedDomains: new Set(parsed.dismissedDomains ?? []),
    origin: filePath,
  };
};

/** Estado vacio, para correr sin base (primer arranque, o CI sin secrets). */
export const emptyState = (): DatabaseState => ({
  stores: [],
  items: [],
  priceRefs: new Set(),
  knownDomains: new Set(),
  dismissedDomains: new Set(),
  origin: 'vacio',
});
