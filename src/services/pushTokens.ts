import { supabase } from '@/lib/supabase';

export type RegisterPushTokenInput = {
  expo_token?: string | null;
  device_token?: unknown | null;
  platform?: string | null;
};

/**
 * Registers or updates the current user's push token(s).
 * Uses RLS: user_id will be set by the DB trigger to auth.uid() on insert/update.
 */
export const registerPushToken = async (payload: RegisterPushTokenInput) => {
  const { expo_token = null, device_token = null, platform = null } = payload;

  // Upsert by expo_token when available, otherwise insert a new row.
  if (expo_token) {
    const { data, error } = await supabase
      .from('push_tokens')
      .upsert({ expo_token, device_token, platform }, { onConflict: 'expo_token' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from('push_tokens').insert({ expo_token, device_token, platform }).select().single();
  if (error) throw error;
  return data;
};

export const listMyPushTokens = async () => {
  const { data, error } = await supabase.from('push_tokens').select('*');
  if (error) throw error;
  return data ?? [];
};
