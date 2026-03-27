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

export const upsertStore = async (payload: Partial<Store> & { name: string }): Promise<Store> => {
  const nextPayload = { ...payload };
  delete nextPayload.user_id;
  delete nextPayload.updated_by;
  const { data, error } = await supabase.from('stores').upsert(nextPayload).select().single();
  if (error) throw error;
  return data;
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
