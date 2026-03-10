import { Button, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { signOut } from '@/features/auth/service';

export default function SettingsScreen() {
  return (
    <AppScreen title="Perfil y ajustes">
      <Text>Perfil básico (MVP). Próxima iteración: preferencias y moneda por defecto.</Text>
      <Button mode="outlined" onPress={() => signOut()}>
        Cerrar sesión
      </Button>
    </AppScreen>
  );
}
