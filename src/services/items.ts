import { supabase } from '@/lib/supabase';
import type { Item } from '@/types/db';

export const listItems = async (): Promise<Item[]> => {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name');
  if (error) throw error;
  return data;
};

export const upsertItem = async (payload: Partial<Item> & { name: string }): Promise<Item> => {
  const { data, error } = await supabase.from('items').upsert(payload).select().single();
  if (error) throw error;
  return data;
};
