import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, Switch, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useToastMessageEffect } from '@/components/AppToastProvider';
import { signOut } from '@/features/auth/service';
import { useThemeStore } from '@/features/theme/store';
import { toUserErrorMessage } from '@/lib/errors';
import { getAppVersion } from '@/lib/appVersion';
import {
  downloadAndInstallAppUpdate,
  fetchAppUpdateRelease,
  getCurrentBuildNumber,
  isAppUpdateAvailable,
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

  const confirmInstallUpdate = (release: AppUpdateRelease): Promise<boolean> =>
    new Promise((resolve) => {
      const details = [
        `Se encontro la version ${release.version} (${release.buildNumber}).`,
        release.notes ? '' : null,
        release.notes ?? null,
        '',
        'Deseas descargarla e instalarla ahora?',
      ]
        .filter(Boolean)
        .join('\n');

      Alert.alert('Actualizacion disponible', details, [
        {
          text: 'Cancelar',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Instalar',
          onPress: () => resolve(true),
        },
      ]);
    });

  const checkAndInstallUpdate = async () => {
    try {
      if (Platform.OS !== 'android') {
        setMessage('La instalacion directa de actualizaciones solo funciona en Android.');
        return;
      }

      const currentBuild = getCurrentBuildNumber();
      if (currentBuild == null) {
        setMessage('Probalo sobre una APK instalada. En Expo Go este flujo no funciona.');
        return;
      }

      setIsUpdatingApp(true);
      const release = await fetchAppUpdateRelease();

      if (!isAppUpdateAvailable(release)) {
        setMessage('La aplicacion ya esta actualizada.');
        return;
      }

      setIsUpdatingApp(false);
      const confirmed = await confirmInstallUpdate(release);

      if (!confirmed) {
        setMessage('Instalacion cancelada.');
        return;
      }

      setIsUpdatingApp(true);
      await downloadAndInstallAppUpdate(release);
      setMessage('La APK se descargo y se abrio el instalador del sistema.');
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo descargar o instalar la actualizacion.'));
    } finally {
      setIsUpdatingApp(false);
    }
  };

  const isAndroid = Platform.OS === 'android';
  const appVersion = getAppVersion();

  return (
    <AppScreen title="Opciones">
      <Text style={{ color: theme.colors.textMuted }}>Configuracion general.</Text>

      <Card mode="outlined">
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Apariencia</Text>
          <View style={[styles.preferenceRow, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Modo oscuro</Text>
            </View>
            <Switch value={preference === 'dark'} onValueChange={(value) => setPreference(value ? 'dark' : 'light')} />
          </View>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Actualizar</Text>
          <Button mode="contained" onPress={checkAndInstallUpdate} loading={isUpdatingApp} disabled={isBusy || !isAndroid}>
            Buscar actualizaciones
          </Button>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Sesion</Text>
          <Button
            mode="outlined"
            loading={isSigningOut}
            disabled={isSigningOut}
            onPress={async () => {
              try {
                setIsSigningOut(true);
                await signOut();
              } catch (error) {
                setMessage(toUserErrorMessage(error, 'No se pudo cerrar sesion.'));
              } finally {
                setIsSigningOut(false);
              }
            }}
          >
            Cerrar sesion
          </Button>
        </Card.Content>
      </Card>

      <Card mode="outlined">
        <Card.Content style={styles.cardContent}>
          <Text variant="titleMedium">Mantenimiento</Text>
          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>Usa esta opcion solo para eliminar trabajos viejos o limpiar datos.</Text>
          <Link href="/quotes/cleanup" asChild>
            <Button mode="outlined" icon="delete-sweep-outline" disabled={isBusy}>
              Limpiar trabajos antiguos
            </Button>
          </Link>
        </Card.Content>
      </Card>

      <Text style={[styles.versionText, { color: theme.colors.textMuted }]}>v{appVersion}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    gap: 12,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  preferenceCopy: {
    flex: 1,
  },
  preferenceTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  versionText: {
    marginTop: 4,
    textAlign: 'center',
  },
});
