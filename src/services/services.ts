import { supabase } from '@/lib/supabase';
import type { Service } from '@/types/db';

export const listServices = async (): Promise<Service[]> => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name');
  if (error) throw error;
  return data;
};

export const upsertService = async (payload: Partial<Service> & { name: string }): Promise<Service> => {
  const { data, error } = await supabase.from('services').upsert(payload).select().single();
  if (error) throw error;
  return data;
};
