import { router } from 'expo-router';
import { useState } from 'react';
import { Snackbar } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { StoreForm } from '@/features/stores/StoreForm';
import { useSaveStore } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';

export default function NewStorePage() {
  const mutation = useSaveStore();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <AppScreen title="Nueva tienda">
      <StoreForm
        onSubmit={async (values) => {
          try {
            await mutation.mutateAsync(values);
            router.back();
          } catch (error) {
            setMessage(toUserErrorMessage(error, 'No se pudo guardar la tienda.'));
          }
        }}
      />
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}
