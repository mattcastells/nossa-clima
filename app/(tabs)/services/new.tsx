import { router } from 'expo-router';
import { useState } from 'react';
import { Snackbar } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { ServiceForm } from '@/features/services/ServiceForm';
import { useSaveService } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';

export default function NewServicePage() {
  const save = useSaveService();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <AppScreen title="Nuevo servicio">
      <ServiceForm
        onSubmit={async (values) => {
          try {
            await save.mutateAsync(values);
            router.back();
          } catch (error) {
            setMessage(toUserErrorMessage(error, 'No se pudo guardar el servicio.'));
          }
        }}
      />
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}
