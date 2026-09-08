import { supabase } from '@/lib/supabase';
import type { Store } from '@/types/db';
import { isMissingSupabaseColumnError } from './supabaseCompatibility';

interface ListStoresOptions {
  includeArchivedIds?: string[];
}

const normalizeIds = (ids: string[] | undefined): string[] => Array.from(new Set((ids ?? []).filter(Boolean))).sort();

export const listStores = async ({ includeArchivedIds }: ListStoresOptions = {}): Promise<Store[]> => {
  const archivedIds = normalizeIds(includeArchivedIds);
  let query = supabase.from('stores').select('*');

  query = archivedIds.length > 0 ? query.or(`archived_at.is.null,id.in.(${archivedIds.join(',')})`) : query.is('archived_at', null);

  const { data, error } = await query.order('name');
  if (error) {
    if (!isMissingSupabaseColumnError(error, 'archived_at')) throw error;

    const fallback = await supabase.from('stores').select('*').order('name');
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
  return data;
};

/**
 * Campos que el cliente nunca escribe: los maneja la base (auditoria) o el
 * relevamiento de proveedores (`tools/supplier-survey`). Si la app pisara
 * `scraped_snapshot` se romperia el merge a tres vias y la proxima corrida
 * creeria que el valor lo puso el scraper.
 */
const SERVER_MANAGED_STORE_FIELDS = [
  'user_id',
  'updated_by',
  'source',
  'source_type',
  'source_url',
  'last_scraped_at',
  'scraped_snapshot',
  'canonical_domain',
] as const satisfies ReadonlyArray<keyof Store>;

/** Columnas que agrego la migracion del relevamiento y pueden no existir aun. */
const SURVEY_STORE_FIELDS = ['website', 'email'] as const satisfies ReadonlyArray<keyof Store>;

export const upsertStore = async (payload: Partial<Store> & { name: string }): Promise<Store> => {
  const nextPayload = { ...payload };
  for (const field of SERVER_MANAGED_STORE_FIELDS) delete nextPayload[field];

  const { data, error } = await supabase.from('stores').upsert(nextPayload).select().single();
  if (!error) return data;

  // Esquema sin la migracion 202609080001: guardamos el resto en vez de fallar.
  const missingField = SURVEY_STORE_FIELDS.find((field) => isMissingSupabaseColumnError(error, field));
  if (!missingField) throw error;

  const fallbackPayload = { ...nextPayload };
  for (const field of SURVEY_STORE_FIELDS) delete fallbackPayload[field];

  const fallback = await supabase.from('stores').upsert(fallbackPayload).select().single();
  if (fallback.error) throw fallback.error;
  return fallback.data;
};

export const archiveStore = async (storeId: string): Promise<Store> => {
  const { data, error } = await supabase
    .from('stores')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', storeId)
    .select()
    .single();
  if (error) {
    if (isMissingSupabaseColumnError(error, 'archived_at')) {
      throw new Error('Falta aplicar la migracion de archivado de catalogos en Supabase.');
    }
    throw error;
  }
  return data;
};
