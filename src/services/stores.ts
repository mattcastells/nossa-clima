import { supabase } from '@/lib/supabase';
import type { Store } from '@/types/db';

export const listStores = async (): Promise<Store[]> => {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name');
  if (error) throw error;
  return data;
};

export const upsertStore = async (payload: Partial<Store> & { name: string }): Promise<Store> => {
  const { data, error } = await supabase.from('stores').upsert(payload).select().single();
  if (error) throw error;
  return data;
};
