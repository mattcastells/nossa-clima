import { supabase } from '@/lib/supabase';

const ensureProfile = async (userId: string): Promise<void> => {
  const { error } = await supabase.from('profiles').upsert({ id: userId }).select('id').single();
  if (error) {
    // No frenar login por perfil, pero dejamos error explícito para debugging.
    // eslint-disable-next-line no-console
    console.warn('No se pudo asegurar perfil del usuario:', error.message);
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
