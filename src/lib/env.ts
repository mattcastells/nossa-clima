const requiredEnv = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const env = {
  supabaseUrl: requiredEnv(process.env.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requiredEnv(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ),
};
