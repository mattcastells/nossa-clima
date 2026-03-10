import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';

import { useAuthSession } from '@/hooks/useAuthSession';
import { queryClient } from '@/lib/query-client';
import { appTheme } from '@/theme';

export default function RootLayout() {
  useAuthSession();

  return (
    <PaperProvider theme={appTheme}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </PaperProvider>
  );
}
