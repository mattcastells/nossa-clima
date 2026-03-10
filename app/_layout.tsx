import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { PaperProvider, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAuthSession } from '@/hooks/useAuthSession';
import { queryClient } from '@/lib/query-client';
import { appTheme } from '@/theme';

export default function RootLayout() {
  const authLoading = useAuthSession();

  return (
    <PaperProvider theme={appTheme}>
      <QueryClientProvider client={queryClient}>
        {authLoading ? (
          <AppScreen title="Precios Técnicos">
            <Text>Cargando sesión...</Text>
          </AppScreen>
        ) : (
          <Stack screenOptions={{ headerShown: false }} />
        )}
      </QueryClientProvider>
    </PaperProvider>
  );
}
