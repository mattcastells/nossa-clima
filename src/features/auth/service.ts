import { supabase } from '@/lib/supabase';
import { logDevWarning } from '@/lib/devLogger';

const ensureProfile = async (userId: string): Promise<void> => {
  const { error } = await supabase.from('profiles').upsert({ id: userId }).select('id').single();
  if (error) {
    logDevWarning('Failed to ensure the user profile exists.', error.message);
  }
};

export const signIn = async (email: string, password: string): Promise<void> => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const userId = data.user?.id;
  if (userId) {
    await ensureProfile(userId);
  }
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const ensureProfileForCurrentSession = async (): Promise<void> => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  const userId = session?.user?.id;
  if (userId) {
    await ensureProfile(userId);
  }
};
