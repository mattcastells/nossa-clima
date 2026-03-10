import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Snackbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { ConfirmDeleteDialog } from '@/features/quotes/components/ConfirmDeleteDialog';
import { QuoteMaterialItemCard } from '@/features/quotes/components/QuoteMaterialItemCard';
import { QuoteServiceItemCard } from '@/features/quotes/components/QuoteServiceItemCard';
import { QuoteTotalsSummary } from '@/features/quotes/components/QuoteTotalsSummary';
import { exportQuotePdf } from '@/features/quotes/exportPdf';
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

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'material' | 'service'; id: string } | null>(null);

  const isBusy =
    save.isPending ||
    updateMaterial.isPending ||
    updateService.isPending ||
    deleteMaterial.isPending ||
    deleteService.isPending ||
    duplicateMaterial.isPending ||
    duplicateService.isPending ||
    isExportingPdf;

  const saveCurrentBudget = async () => {
    if (!data) return;
    try {
      await save.mutateAsync({
        id: data.quote.id,
        title: data.quote.title,
        client_name: data.quote.client_name,
        client_phone: data.quote.client_phone,
        notes: data.quote.notes,
        status: 'draft',
      });
      setSnack('Presupuesto guardado');
    } catch (mutationError) {
      setSnack(toUserErrorMessage(mutationError, 'No se pudo guardar el presupuesto'));
    }
  };

  const exportCurrentBudgetPdf = async () => {
    if (!data) return;
    try {
      setIsExportingPdf(true);
      await exportQuotePdf(data);
      setSnack('PDF generado');
    } catch (exportError) {
      setSnack(toUserErrorMessage(exportError, 'No se pudo exportar el presupuesto'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <AppScreen title="Detalle de presupuesto">
      <LoadingOrError isLoading={isLoading} error={error} />
      {data && (
        <View style={styles.page}>
          <QuoteTotalsSummary
            subtotalMaterials={data.quote.subtotal_materials}
            subtotalServices={data.quote.subtotal_services}
            total={data.quote.total}
          />

          <Card mode="contained" style={styles.sectionCard}>
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleMedium">Cabecera</Text>
              <QuoteForm
                defaultValues={{
                  client_name: data.quote.client_name,
                  client_phone: data.quote.client_phone ?? '',
                  title: data.quote.title,
                  notes: data.quote.notes ?? '',
                }}
                buttonLabel="Guardar cabecera"
                onSubmit={async (values) => {
                  try {
                    await save.mutateAsync({
                      id: data.quote.id,
                      title: values.title,
                      client_name: values.client_name,
                      client_phone: values.client_phone?.trim() ? values.client_phone.trim() : null,
                      notes: values.notes?.trim() ? values.notes.trim() : null,
                      status: 'draft',
                    });
                    setSnack('Cabecera guardada');
                  } catch (mutationError) {
                    setSnack(toUserErrorMessage(mutationError, 'No se pudo guardar la cabecera'));
                  }
                }}
              />
            </Card.Content>
          </Card>

          <Card mode="contained" style={styles.sectionCard}>
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleMedium">Acciones</Text>
              <View style={styles.actionsRow}>
                <Link href={{ pathname: '/quotes/[id]/add-service', params: { id: data.quote.id } }} asChild>
                  <Button mode="contained-tonal" disabled={isBusy} style={styles.actionButton} contentStyle={styles.actionButtonContent}>
                    Agregar servicio
                  </Button>
                </Link>
                <Link href={{ pathname: '/quotes/[id]/add-material', params: { id: data.quote.id } }} asChild>
                  <Button
                    mode="contained-tonal"
                    disabled={isBusy || data.services.length === 0}
                    style={styles.actionButton}
                    contentStyle={styles.actionButtonContent}
                  >
                    Agregar material
                  </Button>
                </Link>
                <Button
                  mode="contained"
                  icon="content-save-outline"
                  disabled={isBusy}
                  onPress={saveCurrentBudget}
                  style={styles.actionButton}
                  contentStyle={styles.actionButtonContent}
                >
                  Guardar presupuesto
                </Button>
                <Button
                  mode="outlined"
                  icon="file-pdf-box"
                  loading={isExportingPdf}
                  disabled={isBusy}
                  onPress={exportCurrentBudgetPdf}
                  style={styles.actionButton}
                  contentStyle={styles.actionButtonContent}
                >
                  Exportar PDF
                </Button>
              </View>
              {data.services.length === 0 && (
                <Text style={styles.helperText}>Primero agrega un servicio para poder cargar materiales.</Text>
              )}
            </Card.Content>
          </Card>

          <Card mode="contained" style={styles.sectionCard}>
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleMedium">Servicios</Text>
              {data.services.length === 0 && <Text>No hay servicios cargados.</Text>}
              <View style={styles.linesList}>
                {data.services.map((serviceLine) => (
                  <QuoteServiceItemCard
                    key={serviceLine.id}
                    item={serviceLine}
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
              </View>
            </Card.Content>
          </Card>

          <Card mode="contained" style={styles.sectionCard}>
            <Card.Content style={styles.sectionContent}>
              <Text variant="titleMedium">Materiales</Text>
              {data.materials.length === 0 && <Text>No hay materiales cargados.</Text>}
              <View style={styles.linesList}>
                {data.materials.map((materialLine) => (
                  <QuoteMaterialItemCard
                    key={materialLine.id}
                    item={materialLine}
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
              </View>
            </Card.Content>
          </Card>

          <QuoteTotalsSummary
            subtotalMaterials={data.quote.subtotal_materials}
            subtotalServices={data.quote.subtotal_services}
            total={data.quote.total}
          />
        </View>
      )}

      <ConfirmDeleteDialog
        visible={Boolean(deleteTarget)}
        title="Eliminar linea"
        message="Seguro que queres eliminar esta linea del presupuesto?"
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
            setSnack(toUserErrorMessage(mutationError, 'No se pudo eliminar la linea'));
          }
        }}
      />

      <Snackbar visible={Boolean(snack)} onDismiss={() => setSnack(null)} duration={2600}>
        {snack}
      </Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 18,
  },
  sectionContent: {
    gap: 16,
    paddingVertical: 10,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE4EC',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    borderRadius: 10,
  },
  actionButtonContent: {
    minHeight: 40,
    paddingHorizontal: 8,
  },
  linesList: {
    gap: 14,
  },
  helperText: {
    color: '#5f6368',
    marginTop: 2,
  },
});
