import { supabase } from '@/lib/supabase';
import type { LatestStoreItemMeasurementPrice, LatestStoreItemPrice, StoreItemMeasurementPrice, StoreItemPrice } from '@/types/db';

import { isMissingSupabaseRelationError } from './supabaseCompatibility';

interface LatestMeasurePriceOptions {
  itemId?: string;
  storeId?: string;
}

const getMeasurePricingMigrationError = (): Error => new Error('Falta aplicar la migracion de medidas de materiales en Supabase.');

export const createPriceRecord = async (
  payload: Omit<StoreItemPrice, 'id' | 'created_at' | 'user_id'>,
): Promise<StoreItemPrice> => {
  const { data: store, error: storeError } = await supabase.from('stores').select('id').eq('id', payload.store_id).single();
  if (storeError) throw storeError;
  if (!store) throw new Error('La tienda no existe.');

  const { data: item, error: itemError } = await supabase.from('items').select('id').eq('id', payload.item_id).single();
  if (itemError) throw itemError;
  if (!item) throw new Error('El material no existe.');

  const { data, error } = await supabase.from('store_item_prices').insert(payload).select().single();
  if (error) throw error;
  return data;
};

export const createMeasurePriceRecord = async (
  payload: Omit<StoreItemMeasurementPrice, 'id' | 'created_at' | 'user_id'>,
): Promise<StoreItemMeasurementPrice> => {
  const { data: measurement, error: measurementError } = await supabase
    .from('item_measurements')
    .select('id')
    .eq('id', payload.item_measurement_id)
    .single();

  if (measurementError) {
    if (isMissingSupabaseRelationError(measurementError, 'item_measurements')) {
      throw getMeasurePricingMigrationError();
    }
    throw measurementError;
  }

  if (!measurement) throw new Error('La medida no existe.');

  const { data, error } = await supabase.from('store_item_measure_prices').insert(payload).select().single();
  if (error) {
    if (isMissingSupabaseRelationError(error, 'store_item_measure_prices')) {
      throw getMeasurePricingMigrationError();
    }
    throw error;
  }

  return data;
};

export const listLatestPrices = async (): Promise<LatestStoreItemPrice[]> => {
  const { data, error } = await supabase.from('latest_store_item_prices').select('*').order('observed_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const listLatestMeasurePrices = async ({ itemId, storeId }: LatestMeasurePriceOptions = {}): Promise<LatestStoreItemMeasurementPrice[]> => {
  let query = supabase.from('latest_effective_store_item_measure_prices').select('*');
  if (itemId) {
    query = query.eq('item_id', itemId);
  }
  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data, error } = await query.order('item_name').order('item_measurement_label');
  if (error) {
    if (isMissingSupabaseRelationError(error, 'latest_effective_store_item_measure_prices')) {
      throw getMeasurePricingMigrationError();
    }
    throw error;
  }

  return data;
};

export const listLatestManualMeasurePrices = async ({ itemId, storeId }: LatestMeasurePriceOptions = {}): Promise<LatestStoreItemMeasurementPrice[]> => {
  let query = supabase.from('latest_store_item_measure_prices').select('*');
  if (itemId) {
    query = query.eq('item_id', itemId);
  }
  if (storeId) {
    query = query.eq('store_id', storeId);
  }

  const { data, error } = await query.order('item_name').order('item_measurement_label');
  if (error) {
    if (isMissingSupabaseRelationError(error, 'latest_store_item_measure_prices')) {
      throw getMeasurePricingMigrationError();
    }
    throw error;
  }

  return data as LatestStoreItemMeasurementPrice[];
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

export const listItemMeasureHistory = async (itemId: string): Promise<LatestStoreItemMeasurementPrice[]> => {
  const { data, error } = await supabase
    .from('item_measure_price_history')
    .select('*')
    .eq('item_id', itemId)
    .order('observed_at', { ascending: false });

  if (error) {
    if (isMissingSupabaseRelationError(error, 'item_measure_price_history')) {
      throw getMeasurePricingMigrationError();
    }
    throw error;
  }

  return data as LatestStoreItemMeasurementPrice[];
};
