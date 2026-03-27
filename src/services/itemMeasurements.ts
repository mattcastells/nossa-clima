import { supabase } from '@/lib/supabase';
import type { ItemMeasurement } from '@/types/db';

import { isMissingSupabaseColumnError, isMissingSupabaseRelationError } from './supabaseCompatibility';

interface ListItemMeasurementsOptions {
  includeArchivedIds?: string[];
}

const normalizeIds = (ids: string[] | undefined): string[] => Array.from(new Set((ids ?? []).filter(Boolean))).sort();

const getMeasurementsMigrationError = (): Error => new Error('Falta aplicar la migracion de medidas de materiales en Supabase.');

export const listItemMeasurements = async (
  itemId: string,
  { includeArchivedIds }: ListItemMeasurementsOptions = {},
): Promise<ItemMeasurement[]> => {
  const archivedIds = normalizeIds(includeArchivedIds);
  let query = supabase.from('item_measurements').select('*').eq('item_id', itemId);
  query =
    archivedIds.length > 0
      ? query.or(`archived_at.is.null,id.in.(${archivedIds.join(',')})`)
      : query.is('archived_at', null);

  const { data, error } = await query.order('sort_order').order('label');
  if (error) {
    if (isMissingSupabaseRelationError(error, 'item_measurements') || isMissingSupabaseColumnError(error, 'archived_at')) {
      throw getMeasurementsMigrationError();
    }
    throw error;
  }

  return data;
};

export const upsertItemMeasurement = async (
  payload: Partial<ItemMeasurement> & Pick<ItemMeasurement, 'item_id' | 'label' | 'pricing_mode'>,
): Promise<ItemMeasurement> => {
  const nextPayload = { ...payload };
  delete nextPayload.user_id;
  delete nextPayload.updated_by;

  const { data, error } = await supabase.from('item_measurements').upsert(nextPayload).select().single();
  if (error) {
    if (isMissingSupabaseRelationError(error, 'item_measurements')) {
      throw getMeasurementsMigrationError();
    }
    throw error;
  }

  return data;
};
