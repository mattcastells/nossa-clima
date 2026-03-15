import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { PaperProvider, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getMissingRequiredEnvVars, hasMissingRequiredEnvVars } from '@/lib/env';
import { queryClient } from '@/lib/query-client';
import { appTheme } from '@/theme';

function AppShell() {
  const authLoading = useAuthSession();

  return authLoading ? (
    <AppScreen title="Nossa Clima" showBackButton={false}>
      <Text>Cargando sesion...</Text>
    </AppScreen>
  ) : (
    <Stack screenOptions={{ headerShown: false }} />
  );
}

export default function RootLayout() {
  const [iconFontsLoaded] = useFonts(MaterialCommunityIcons.font);
  const missingEnvVars = hasMissingRequiredEnvVars ? getMissingRequiredEnvVars() : [];

  return (
    <PaperProvider theme={appTheme}>
      <QueryClientProvider client={queryClient}>
        {!iconFontsLoaded ? (
          <AppScreen title="Nossa Clima" showBackButton={false}>
            <Text>Cargando recursos...</Text>
          </AppScreen>
        ) : missingEnvVars.length > 0 ? (
          <AppScreen title="Nossa Clima" showBackButton={false}>
            <Text>Faltan variables de configuracion en la APK.</Text>
            <Text>{missingEnvVars.join(', ')}</Text>
          </AppScreen>
        ) : (
          <AppShell />
        )}
      </QueryClientProvider>
    </PaperProvider>
  );
}
