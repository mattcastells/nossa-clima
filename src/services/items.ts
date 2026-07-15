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

export interface ItemListStats {
  measurementCount: number;
  storeCount: number;
}

export type ItemWithStats = Item & ItemListStats;

/**
 * Materials plus the counters the list card shows ("2 medidas · precio en 2 tiendas").
 * Prices live in two tables — store_item_prices for direct pricing and
 * store_item_measure_prices per measurement — and both are historical, so a store
 * only counts once no matter how many observations it has.
 *
 * Counters are resolved with id-only lookups instead of nested selects to keep the
 * payload small; a failure there degrades to zeroes rather than breaking the list.
 */
export const listItemsWithStats = async (options: ListItemsOptions = {}): Promise<ItemWithStats[]> => {
  const items = await listItems(options);
  if (items.length === 0) return [];

  const itemIds = items.map((item) => item.id);
  const withoutStats = (): ItemWithStats[] => items.map((item) => ({ ...item, measurementCount: 0, storeCount: 0 }));

  try {
    const [measurements, directPrices] = await Promise.all([
      supabase.from('item_measurements').select('id,item_id').in('item_id', itemIds),
      supabase.from('store_item_prices').select('item_id,store_id').in('item_id', itemIds),
    ]);
    if (measurements.error) throw measurements.error;
    if (directPrices.error) throw directPrices.error;

    const measurementRows = measurements.data ?? [];
    const itemIdByMeasurementId = new Map<string, string>(measurementRows.map((row) => [row.id, row.item_id]));

    const measurementCountByItemId = new Map<string, number>();
    measurementRows.forEach((row) => {
      measurementCountByItemId.set(row.item_id, (measurementCountByItemId.get(row.item_id) ?? 0) + 1);
    });

    const storeIdsByItemId = new Map<string, Set<string>>();
    const addStore = (itemId: string | undefined, storeId: string) => {
      if (!itemId) return;
      const stores = storeIdsByItemId.get(itemId) ?? new Set<string>();
      stores.add(storeId);
      storeIdsByItemId.set(itemId, stores);
    };
    (directPrices.data ?? []).forEach((row) => addStore(row.item_id, row.store_id));

    const measurementIds = measurementRows.map((row) => row.id);
    if (measurementIds.length > 0) {
      const measurePrices = await supabase
        .from('store_item_measure_prices')
        .select('item_measurement_id,store_id')
        .in('item_measurement_id', measurementIds);
      if (measurePrices.error) throw measurePrices.error;
      (measurePrices.data ?? []).forEach((row) => addStore(itemIdByMeasurementId.get(row.item_measurement_id), row.store_id));
    }

    return items.map((item) => ({
      ...item,
      measurementCount: measurementCountByItemId.get(item.id) ?? 0,
      storeCount: storeIdsByItemId.get(item.id)?.size ?? 0,
    }));
  } catch {
    return withoutStats();
  }
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
