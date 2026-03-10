import { supabase } from '@/lib/supabase';

export interface DashboardSummary {
  totalStores: number;
  totalItems: number;
  latestPrices: Array<{
    id: string;
    store_name: string;
    item_name: string;
    price: number;
    observed_at: string;
  }>;
}

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const [{ count: storeCount, error: storesError }, { count: itemCount, error: itemsError }, latest] =
    await Promise.all([
      supabase.from('stores').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('items').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase
        .from('latest_store_item_prices')
        .select('id, store_name, item_name, price, observed_at')
        .order('observed_at', { ascending: false })
        .limit(5),
    ]);

  if (storesError) throw storesError;
  if (itemsError) throw itemsError;
  if (latest.error) throw latest.error;

  return {
    totalStores: storeCount ?? 0,
    totalItems: itemCount ?? 0,
    latestPrices: latest.data,
  };
};
