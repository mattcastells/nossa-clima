import { useState } from 'react';
import { Button, Snackbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { signOut } from '@/features/auth/service';
import { toUserErrorMessage } from '@/lib/errors';

export default function SettingsScreen() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <AppScreen title="Perfil y ajustes">
      <Text>Perfil básico (MVP). Próxima iteración: preferencias y moneda por defecto.</Text>
      <Button
        mode="outlined"
        loading={isSigningOut}
        disabled={isSigningOut}
        onPress={async () => {
          try {
            setIsSigningOut(true);
            await signOut();
          } catch (error) {
            setMessage(toUserErrorMessage(error, 'No se pudo cerrar sesión.'));
          } finally {
            setIsSigningOut(false);
          }
        }}
      >
        Cerrar sesión
      </Button>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}
