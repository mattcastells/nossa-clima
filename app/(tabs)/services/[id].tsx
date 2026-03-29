import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { ServiceForm } from '@/features/services/ServiceForm';
import { useDeleteService, useSaveService, useServiceCategories, useServices } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { getSingleRouteParam } from '@/lib/routeParams';

export default function ServiceDetailPage() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = getSingleRouteParam(params.id).trim();
  const router = useRouter();
  const { data, isLoading, error } = useServices();
  const { data: categories } = useServiceCategories();
  const save = useSaveService();
  const archive = useDeleteService();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));
  const service = data?.find((s) => s.id === id);

  return (
    <AppScreen title="Detalle de servicio">
      <LoadingOrError isLoading={isLoading} error={error} />
      {service && (
        <>
          <Text>Podes editar nombre, descripcion y costo base del servicio.</Text>
          <ServiceForm
            categorySuggestions={categories ?? []}
            defaultValues={{
              name: service.name,
              base_price: service.base_price,
              description: service.description ?? '',
              category: service.category ?? '',
              unit_type: service.unit_type ?? '',
            }}
            onSubmit={async (values) => {
              try {
                await save.mutateAsync({
                  id: service.id,
                  name: values.name,
                  base_price: values.base_price,
                  description: values.description?.trim() ? values.description.trim() : null,
                  category: values.category?.trim() ? values.category.trim() : null,
                  unit_type: values.unit_type?.trim() ? values.unit_type.trim() : null,
                });
                toast.success('Servicio guardado.');
                router.back();
              } catch (saveError) {
                setMessage(toUserErrorMessage(saveError, 'No se pudo guardar el servicio.'));
              }
            }}
          />
          <Button mode="contained" buttonColor="#B3261E" textColor="#FFFFFF" onPress={() => setConfirmArchive(true)} disabled={archive.isPending}>
            Archivar servicio
          </Button>
        </>
      )}

      <Portal>
        <AppDialog visible={confirmArchive} onDismiss={() => !archive.isPending && setConfirmArchive(false)}>
          <Dialog.Title>Archivar servicio</Dialog.Title>
          <Dialog.Content>
            <Text>El servicio deja de aparecer en cargas nuevas, pero los trabajos viejos conservan su snapshot.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={archive.isPending} onPress={() => setConfirmArchive(false)}>
              Cancelar
            </Button>
            <Button
              loading={archive.isPending}
              textColor="#B3261E"
              onPress={async () => {
                if (!service) return;
                try {
                  await archive.mutateAsync(service.id);
                  setConfirmArchive(false);
                  toast.success('Servicio archivado.');
                  router.back();
                } catch (archiveError) {
                  setConfirmArchive(false);
                  setMessage(toUserErrorMessage(archiveError, 'No se pudo archivar el servicio.'));
                }
              }}
            >
              Archivar
            </Button>
          </Dialog.Actions>
        </AppDialog>
      </Portal>
    </AppScreen>
  );
}
