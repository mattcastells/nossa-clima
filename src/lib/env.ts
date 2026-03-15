const missingRequiredEnvVars: string[] = [];

const requiredEnv = (value: string | undefined, key: string, fallback: string): string => {
  const trimmed = value?.trim();
  if (!trimmed) {
    missingRequiredEnvVars.push(key);
    return fallback;
  }

  return trimmed;
};

const optionalEnv = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const env = {
  supabaseUrl: requiredEnv(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    'EXPO_PUBLIC_SUPABASE_URL',
    'https://invalid-project-ref.supabase.co',
  ),
  supabaseAnonKey: requiredEnv(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'invalid-anon-key',
  ),
  appUpdateGitHubRepo: optionalEnv(process.env.EXPO_PUBLIC_APP_UPDATE_GITHUB_REPO),
};

export const hasMissingRequiredEnvVars = missingRequiredEnvVars.length > 0;
export const getMissingRequiredEnvVars = (): string[] => [...missingRequiredEnvVars];
