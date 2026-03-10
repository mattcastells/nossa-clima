import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Dialog, Portal, Snackbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { ServiceForm } from '@/features/services/ServiceForm';
import { useDeleteService, useSaveService, useServices } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';

export default function ServiceDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useServices();
  const save = useSaveService();
  const remove = useDeleteService();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const service = data?.find((s) => s.id === id);

  return (
    <AppScreen title="Detalle de servicio">
      <LoadingOrError isLoading={isLoading} error={error} />
      {service && (
        <>
          <Text>Podés editar nombre y precio base del servicio.</Text>
          <ServiceForm
            defaultValues={service}
            onSubmit={async (values) => {
              try {
                await save.mutateAsync({ ...values, id: service.id });
                router.back();
              } catch (saveError) {
                setMessage(toUserErrorMessage(saveError, 'No se pudo guardar el servicio.'));
              }
            }}
          />
          <Button mode="outlined" textColor="#B3261E" onPress={() => setConfirmDelete(true)} disabled={remove.isPending}>
            Borrar servicio
          </Button>
        </>
      )}

      <Portal>
        <Dialog visible={confirmDelete} onDismiss={() => !remove.isPending && setConfirmDelete(false)}>
          <Dialog.Title>Borrar servicio</Dialog.Title>
          <Dialog.Content>
            <Text>¿Seguro que querés borrar este servicio?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={remove.isPending} onPress={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              loading={remove.isPending}
              textColor="#B3261E"
              onPress={async () => {
                if (!service) return;
                try {
                  await remove.mutateAsync(service.id);
                  setConfirmDelete(false);
                  router.back();
                } catch (deleteError) {
                  setConfirmDelete(false);
                  setMessage(toUserErrorMessage(deleteError, 'No se pudo borrar el servicio.'));
                }
              }}
            >
              Borrar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}
