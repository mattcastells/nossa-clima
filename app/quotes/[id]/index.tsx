import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Snackbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { QuoteForm } from '@/features/quotes/QuoteForm';
import {
  useDeleteQuoteMaterialItem,
  useDeleteQuoteServiceItem,
  useDuplicateQuoteMaterialItem,
  useDuplicateQuoteServiceItem,
  useQuoteDetail,
  useSaveQuote,
  useUpdateQuoteMaterialItem,
  useUpdateQuoteServiceItem,
} from '@/features/quotes/hooks';
import { ConfirmDeleteDialog } from '@/features/quotes/components/ConfirmDeleteDialog';
import { QuoteMaterialItemCard } from '@/features/quotes/components/QuoteMaterialItemCard';
import { QuoteServiceItemCard } from '@/features/quotes/components/QuoteServiceItemCard';
import { QuoteTotalsSummary } from '@/features/quotes/components/QuoteTotalsSummary';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';

export default function QuoteDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useQuoteDetail(id);
  const { data: stores } = useStores();
  const save = useSaveQuote();
  const updateMaterial = useUpdateQuoteMaterialItem();
  const updateService = useUpdateQuoteServiceItem();
  const deleteMaterial = useDeleteQuoteMaterialItem();
  const deleteService = useDeleteQuoteServiceItem();
  const duplicateMaterial = useDuplicateQuoteMaterialItem();
  const duplicateService = useDuplicateQuoteServiceItem();

  const [snack, setSnack] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'material' | 'service'; id: string } | null>(null);

  return (
    <AppScreen title="Detalle de presupuesto">
      <LoadingOrError isLoading={isLoading} error={error} />
      {data && (
        <View style={{ gap: 12 }}>
          <QuoteTotalsSummary
            subtotalMaterials={data.quote.subtotal_materials}
            subtotalServices={data.quote.subtotal_services}
            total={data.quote.total}
          />

          <QuoteForm
            defaultValues={data.quote}
            buttonLabel="Guardar cabecera"
            onSubmit={async (values) => {
              try {
                await save.mutateAsync({ ...values, id: data.quote.id });
                setSnack('Cabecera guardada');
              } catch (mutationError) {
                setSnack(toUserErrorMessage(mutationError, 'No se pudo guardar la cabecera'));
              }
            }}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Link href={`/quotes/${data.quote.id}/add-material`} asChild>
              <Button mode="contained-tonal" disabled={save.isPending || updateMaterial.isPending || updateService.isPending}>Agregar material</Button>
            </Link>
            <Link href={`/quotes/${data.quote.id}/add-service`} asChild>
              <Button mode="contained-tonal" disabled={save.isPending || updateMaterial.isPending || updateService.isPending}>Agregar servicio</Button>
            </Link>
          </View>

          <Text variant="titleLarge">Materiales</Text>
          {data.materials.length === 0 && <Text>No hay materiales cargados.</Text>}
          {data.materials.map((m) => (
            <QuoteMaterialItemCard
              key={m.id}
              item={m}
              stores={stores ?? []}
              onSave={async (itemId, payload) => {
                try {
                  await updateMaterial.mutateAsync({ itemId, payload });
                  setSnack('Material actualizado');
                } catch (mutationError) {
                  setSnack(toUserErrorMessage(mutationError, 'No se pudo actualizar el material'));
                }
              }}
              onDuplicate={async (itemId) => {
                try {
                  await duplicateMaterial.mutateAsync(itemId);
                  setSnack('Material duplicado');
                } catch (mutationError) {
                  setSnack(toUserErrorMessage(mutationError, 'No se pudo duplicar el material'));
                }
              }}
              onDelete={(itemId) => setDeleteTarget({ kind: 'material', id: itemId })}
              saving={updateMaterial.isPending}
              duplicating={duplicateMaterial.isPending}
              deleting={deleteMaterial.isPending}
            />
          ))}

          <Text variant="titleLarge">Mano de obra</Text>
          {data.services.length === 0 && <Text>No hay servicios cargados.</Text>}
          {data.services.map((s) => (
            <QuoteServiceItemCard
              key={s.id}
              item={s}
              onSave={async (itemId, payload) => {
                try {
                  await updateService.mutateAsync({ itemId, payload });
                  setSnack('Servicio actualizado');
                } catch (mutationError) {
                  setSnack(toUserErrorMessage(mutationError, 'No se pudo actualizar el servicio'));
                }
              }}
              onDuplicate={async (itemId) => {
                try {
                  await duplicateService.mutateAsync(itemId);
                  setSnack('Servicio duplicado');
                } catch (mutationError) {
                  setSnack(toUserErrorMessage(mutationError, 'No se pudo duplicar el servicio'));
                }
              }}
              onDelete={(itemId) => setDeleteTarget({ kind: 'service', id: itemId })}
              saving={updateService.isPending}
              duplicating={duplicateService.isPending}
              deleting={deleteService.isPending}
            />
          ))}

          <QuoteTotalsSummary
            subtotalMaterials={data.quote.subtotal_materials}
            subtotalServices={data.quote.subtotal_services}
            total={data.quote.total}
          />
        </View>
      )}

      <ConfirmDeleteDialog
        visible={Boolean(deleteTarget)}
        title="Eliminar línea"
        message="¿Seguro que querés eliminar esta línea del presupuesto?"
        loading={deleteMaterial.isPending || deleteService.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            if (deleteTarget.kind === 'material') {
              await deleteMaterial.mutateAsync(deleteTarget.id);
              setSnack('Material eliminado');
            } else {
              await deleteService.mutateAsync(deleteTarget.id);
              setSnack('Servicio eliminado');
            }
            setDeleteTarget(null);
          } catch (mutationError) {
            setSnack(toUserErrorMessage(mutationError, 'No se pudo eliminar la línea'));
          }
        }}
      />

      <Snackbar visible={Boolean(snack)} onDismiss={() => setSnack(null)} duration={2400}>
        {snack}
      </Snackbar>
    </AppScreen>
  );
}
