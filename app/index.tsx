import { Redirect } from 'expo-router';

import { useAuthStore } from '@/features/auth/store';

export default function IndexPage() {
  const userId = useAuthStore((s) => s.userId);
  return <Redirect href={userId ? '/(tabs)' : '/(auth)/login'} />;
}
