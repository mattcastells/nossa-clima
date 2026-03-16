import { supabase } from '@/lib/supabase';
import { isMissingSupabaseColumnError } from './supabaseCompatibility';
import type { Item } from '@/types/db';

interface ListItemsOptions {
  includeArchivedIds?: string[];
}

const normalizeIds = (ids: string[] | undefined): string[] => Array.from(new Set((ids ?? []).filter(Boolean))).sort();

export const listItems = async ({ includeArchivedIds }: ListItemsOptions = {}): Promise<Item[]> => {
  const archivedIds = normalizeIds(includeArchivedIds);
  let query = supabase.from('items').select('*');

  query = archivedIds.length > 0 ? query.or(`archived_at.is.null,id.in.(${archivedIds.join(',')})`) : query.is('archived_at', null);

  const { data, error } = await query.order('name');
  if (error) {
    if (!isMissingSupabaseColumnError(error, 'archived_at')) throw error;

    const fallback = await supabase.from('items').select('*').order('name');
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
  return data;
};

export const upsertItem = async (payload: Partial<Item> & { name: string }): Promise<Item> => {
  const nextPayload = { ...payload };
  delete nextPayload.user_id;
  delete nextPayload.updated_by;

  const { data, error } = await supabase.from('items').upsert(nextPayload).select().single();
  if (error) {
    if (
      isMissingSupabaseColumnError(error, 'base_price_label') ||
      isMissingSupabaseColumnError(error, 'variant_label') ||
      isMissingSupabaseColumnError(error, 'presentation_quantity') ||
      isMissingSupabaseColumnError(error, 'presentation_unit')
    ) {
      throw new Error('Falta aplicar la migracion de materiales con medidas en Supabase.');
    }
    throw error;
  }
  return data;
};
