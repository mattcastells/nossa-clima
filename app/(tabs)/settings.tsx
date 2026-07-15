import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Switch, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useToastMessageEffect } from '@/components/AppToastProvider';
import { signOut } from '@/features/auth/service';
import { useThemeStore } from '@/features/theme/store';
import { toUserErrorMessage } from '@/lib/errors';
import { getAppVersion } from '@/lib/appVersion';
import {
  downloadAndInstallAppUpdate,
  fetchAppUpdateRelease,
  getAppUpdateStatus,
  getCurrentBuildNumber,
  type AppUpdateRelease,
} from '@/services/appUpdates';
import { useAppTheme } from '@/theme';

export default function SettingsScreen() {
  const theme = useAppTheme();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUpdatingApp, setIsUpdatingApp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  useToastMessageEffect(message, () => setMessage(null));

  const isBusy = isSigningOut || isUpdatingApp;
  const appVersion = getAppVersion();
  const isAndroid = Platform.OS === 'android';

  const confirmInstallUpdate = (release: AppUpdateRelease): Promise<boolean> =>
    new Promise((resolve) => {
      const details = [
        `Se encontró la versión ${release.version} (${release.buildNumber}).`,
        release.notes ? '' : null,
        release.notes ?? null,
        '',
        '¿Deseás descargarla e instalarla ahora?',
      ]
        .filter(Boolean)
        .join('\n');

      Alert.alert('Actualización disponible', details, [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Instalar', onPress: () => resolve(true) },
      ]);
    });

  const checkAndInstallUpdate = async () => {
    try {
      if (Platform.OS !== 'android') {
        setMessage('La instalación directa de actualizaciones solo funciona en Android.');
        return;
      }
      const currentBuild = getCurrentBuildNumber();
      if (currentBuild == null) {
        setMessage('Probalo sobre una APK instalada. En Expo Go este flujo no funciona.');
        return;
      }
      setIsUpdatingApp(true);
      const release = await fetchAppUpdateRelease();
      const updateStatus = getAppUpdateStatus(release);
      if (updateStatus !== 'update-available') {
        if (updateStatus === 'newer-release-blocked-by-build') {
          setMessage(
            `Se encontró v${release.version} (b${release.buildNumber}), pero tu app está en v${appVersion} (b${currentBuild}). Para actualizar por APK, la release necesita un build mayor al instalado.`,
          );
          return;
        }
        setMessage('La aplicación ya está actualizada.');
        return;
      }
      setIsUpdatingApp(false);
      const confirmed = await confirmInstallUpdate(release);
      if (!confirmed) {
        setMessage('Instalación cancelada.');
        return;
      }
      setIsUpdatingApp(true);
      await downloadAndInstallAppUpdate(release);
      setMessage('La APK se descargó y se abrió el instalador del sistema.');
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo descargar o instalar la actualización.'));
    } finally {
      setIsUpdatingApp(false);
    }
  };

  const signOutNow = async () => {
    try {
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo cerrar sesión.'));
    } finally {
      setIsSigningOut(false);
    }
  };

  const sectionLabel = (label: string) => (
    <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>{label}</Text>
  );

  return (
    <AppScreen title="Opciones">
      <View style={styles.group}>
        {sectionLabel('APARIENCIA')}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: theme.colors.softBlue }]}>
              <Icon source="weather-night" size={20} color={theme.colors.primary} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.colors.titleOnSoft }]}>Modo oscuro</Text>
            <Switch value={preference === 'dark'} onValueChange={(value) => setPreference(value ? 'dark' : 'light')} color={theme.colors.accent} />
          </View>
        </View>
      </View>

      <View style={styles.group}>
        {sectionLabel('APLICACIÓN')}
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
          <Pressable
            accessibilityRole="button"
            onPress={checkAndInstallUpdate}
            disabled={isBusy || !isAndroid}
            style={({ pressed }) => [styles.row, styles.rowBorder, { borderBottomColor: theme.colors.borderSoft }, pressed && styles.pressed, (isBusy || !isAndroid) && styles.disabled]}
          >
            <View style={[styles.rowIcon, { backgroundColor: theme.colors.accentSoft }]}>
              <Icon source="cloud-download-outline" size={20} color={theme.colors.accentStrong} />
            </View>
            <Text style={[styles.rowLabel, { color: theme.colors.titleOnSoft }]}>Buscar actualizaciones</Text>
            {isUpdatingApp ? <ActivityIndicator size={18} color={theme.colors.accent} /> : <Icon source="chevron-right" size={22} color={theme.colors.outline} />}
          </Pressable>
          <Link href="/quotes/cleanup" asChild>
            <Pressable
              accessibilityRole="button"
              disabled={isBusy}
              style={({ pressed }) => [styles.row, pressed && styles.pressed, isBusy && styles.disabled]}
            >
              <View style={[styles.rowIcon, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Icon source="delete-sweep-outline" size={20} color={theme.colors.textMuted} />
              </View>
              <Text style={[styles.rowLabel, { color: theme.colors.titleOnSoft }]}>Limpiar trabajos antiguos</Text>
              <Icon source="chevron-right" size={22} color={theme.colors.outline} />
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={styles.group}>
        {sectionLabel('CUENTA')}
        <Pressable
          accessibilityRole="button"
          onPress={signOutNow}
          disabled={isSigningOut}
          style={({ pressed }) => [styles.card, styles.row, { backgroundColor: theme.colors.surface, borderColor: '#FBD0D0' }, pressed && styles.pressed, isSigningOut && styles.disabled]}
        >
          <View style={[styles.rowIcon, { backgroundColor: theme.colors.toastErrorSurface }]}>
            <Icon source="logout" size={20} color={theme.colors.error} />
          </View>
          <Text style={[styles.rowLabel, { color: theme.colors.error, fontWeight: '700' }]}>Cerrar sesión</Text>
          {isSigningOut ? <ActivityIndicator size={18} color={theme.colors.error} /> : null}
        </Pressable>
      </View>

      <Text style={[styles.versionText, { color: theme.colors.textMuted }]}>v{appVersion}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  versionText: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 13,
  },
});
