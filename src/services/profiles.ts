import { supabase } from '@/lib/supabase';
import type { ProfileDirectoryEntry } from '@/types/db';
import { isMissingSupabaseRelationError } from './supabaseCompatibility';

const normalizeIds = (ids: string[]): string[] => Array.from(new Set(ids.filter(Boolean))).sort();

export const listProfileDirectory = async (ids: string[]): Promise<ProfileDirectoryEntry[]> => {
  const normalizedIds = normalizeIds(ids);
  if (normalizedIds.length === 0) return [];

  const { data, error } = await supabase.from('profile_directory').select('id, full_name').in('id', normalizedIds);
  if (error) {
    if (isMissingSupabaseRelationError(error, 'profile_directory')) {
      return [];
    }
    throw error;
  }

  return data ?? [];
};
