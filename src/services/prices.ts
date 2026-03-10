import { supabase } from '@/lib/supabase';
import type { LatestStoreItemPrice, StoreItemPrice } from '@/types/db';

export const createPriceRecord = async (
  payload: Omit<StoreItemPrice, 'id' | 'created_at' | 'user_id'>,
): Promise<StoreItemPrice> => {
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, is_active')
    .eq('id', payload.store_id)
    .single();
  if (storeError) throw storeError;
  if (!store.is_active) throw new Error('La tienda está archivada');

  const { data: item, error: itemError } = await supabase
    .from('items')
    .select('id, is_active')
    .eq('id', payload.item_id)
    .single();
  if (itemError) throw itemError;
  if (!item.is_active) throw new Error('El ítem está archivado');

  const { data, error } = await supabase.from('store_item_prices').insert(payload).select().single();
  if (error) throw error;
  return data;
};

export const listLatestPrices = async (): Promise<LatestStoreItemPrice[]> => {
  const { data, error } = await supabase
    .from('latest_store_item_prices')
    .select('*')
    .order('observed_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const listItemHistory = async (itemId: string): Promise<LatestStoreItemPrice[]> => {
  const { data, error } = await supabase
    .from('item_price_history')
    .select('*')
    .eq('item_id', itemId)
    .order('observed_at', { ascending: false });
  if (error) throw error;
  return data;
};
