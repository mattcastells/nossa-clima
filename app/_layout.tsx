import { MaterialCommunityIcons } from '@expo/vector-icons';
import { QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Stack, useGlobalSearchParams, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { PaperProvider, Text } from 'react-native-paper';

import { AppToastProvider } from '@/components/AppToastProvider';
import { AppScreen } from '@/components/AppScreen';
import { useAuthStore } from '@/features/auth/store';
import { useThemeStore } from '@/features/theme/store';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getMissingRequiredEnvVars, hasMissingRequiredEnvVars } from '@/lib/env';
import { queryClient } from '@/lib/query-client';
import { darkTheme, lightTheme } from '@/theme';

function AppShell({ backgroundColor }: { backgroundColor: string }) {
  const authLoading = useAuthSession();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const globalSearchParams = useGlobalSearchParams();
  const userId = useAuthStore((s) => s.userId);
  const pendingPath = useAuthStore((s) => s.pendingPath);
  const setPendingPath = useAuthStore((s) => s.setPendingPath);
  const clearPendingPath = useAuthStore((s) => s.clearPendingPath);
  const inAuth = segments[0] === '(auth)';

  useEffect(() => {
    if (authLoading) return;

    if (!userId && !inAuth) {
      const query = new URLSearchParams();
      Object.entries(globalSearchParams).forEach(([key, value]) => {
        if (typeof value === 'string' && value) {
          query.set(key, value);
        }
      });

      const nextPath = query.size > 0 ? `${pathname}?${query.toString()}` : pathname;
      if (nextPath && pendingPath !== nextPath) {
        setPendingPath(nextPath);
      }
      router.replace('/(auth)/login');
      return;
    }

    if (userId && inAuth) {
      const destination = pendingPath ?? '/(tabs)';
      clearPendingPath();
      router.replace(destination as never);
    }
  }, [authLoading, clearPendingPath, globalSearchParams, inAuth, pathname, pendingPath, router, setPendingPath, userId]);

  return authLoading ? (
    <AppScreen title="Nossa Clima" showBackButton={false}>
      <Text>Cargando sesion...</Text>
    </AppScreen>
  ) : (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor } }} />
  );
}

export default function RootLayout() {
  const [iconFontsLoaded] = useFonts(MaterialCommunityIcons.font);
  const missingEnvVars = hasMissingRequiredEnvVars ? getMissingRequiredEnvVars() : [];
  const preference = useThemeStore((s) => s.preference);
  const hasHydrated = useThemeStore((s) => s.hasHydrated);
  const activeTheme = preference === 'dark' ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={activeTheme}>
      <StatusBar style={preference === 'dark' ? 'light' : 'dark'} />
      <QueryClientProvider client={queryClient}>
        <AppToastProvider>
          {!iconFontsLoaded || !hasHydrated ? (
            <AppScreen title="Nossa Clima" showBackButton={false}>
              <Text>Cargando recursos...</Text>
            </AppScreen>
          ) : missingEnvVars.length > 0 ? (
            <AppScreen title="Nossa Clima" showBackButton={false}>
              <Text>Faltan variables de configuracion en la APK.</Text>
              <Text>{missingEnvVars.join(', ')}</Text>
            </AppScreen>
          ) : (
            <AppShell backgroundColor={activeTheme.colors.background} />
          )}
        </AppToastProvider>
      </QueryClientProvider>
    </PaperProvider>
  );
}
