import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Divider, Snackbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useDeleteAppointment, useUpsertQuoteAppointment } from '@/features/appointments/hooks';
import { ConfirmDeleteDialog } from '@/features/quotes/components/ConfirmDeleteDialog';
import { QuoteItemsTable } from '@/features/quotes/components/QuoteItemsTable';
import { QuoteTotalsSummary } from '@/features/quotes/components/QuoteTotalsSummary';
import { exportQuotePdf } from '@/features/quotes/exportPdf';
import { QuoteForm } from '@/features/quotes/QuoteForm';
import {
  useDeleteQuoteMaterialItem,
  useDeleteQuoteServiceItem,
  useQuoteDetail,
  useResetQuoteMaterialItemMarginsToDefault,
  useSaveQuote,
  useUpdateQuoteMaterialItem,
  useUpdateQuoteServiceItem,
} from '@/features/quotes/hooks';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';

const formatDateForInput = (value: Date): string => {
  const day = String(value.getDate()).padStart(2, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const year = value.getFullYear();
  return `${day}-${month}-${year}`;
};

const formatStoredDateForInput = (value: string): string => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!isoMatch) {
    return trimmed;
  }

  const [, year, month, day] = isoMatch;
  return `${day}-${month}-${year}`;
};

const isValidDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(year, month - 1, day);

  return !Number.isNaN(date.getTime()) && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const normalizeDateInput = (value: string): string => {
  const trimmed = value.trim();
  const localMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (localMatch) {
    const [, rawDay, rawMonth, rawYear] = localMatch;
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);

    if (!isValidDate(year, month, day)) {
      throw new Error('La fecha ingresada no es valida.');
    }

    return `${rawYear}-${rawMonth}-${rawDay}`;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, rawYear, rawMonth, rawDay] = isoMatch;
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);

    if (!isValidDate(year, month, day)) {
      throw new Error('La fecha ingresada no es valida.');
    }

    return trimmed;
  }

  throw new Error('La fecha debe tener formato DD-MM-AAAA.');
};

const normalizeTimeInput = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
    throw new Error('La hora debe tener formato HH:mm.');
  }

  return `${trimmed}:00`;
};

const normalizeOptionalPercentInput = (value: string): number | null => {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('El margen debe ser un numero mayor o igual a 0.');
  }

  return Number(parsed.toFixed(2));
};

export default function QuoteDetailPage() {
  const { id, linkWarning } = useLocalSearchParams<{ id: string; linkWarning?: string }>();
  const { data, isLoading, error } = useQuoteDetail(id);
  const { data: stores } = useStores();
  const save = useSaveQuote();
  const scheduleQuote = useUpsertQuoteAppointment();
  const deleteAppointment = useDeleteAppointment();
  const updateMaterial = useUpdateQuoteMaterialItem();
  const updateService = useUpdateQuoteServiceItem();
  const deleteMaterial = useDeleteQuoteMaterialItem();
  const deleteService = useDeleteQuoteServiceItem();
  const resetMaterialMargins = useResetQuoteMaterialItemMarginsToDefault();

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(formatDateForInput(new Date()));
  const [scheduleTime, setScheduleTime] = useState('');
  const [globalMarginInput, setGlobalMarginInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'material' | 'service'; id: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    if (!data.appointment) {
      setScheduleDate(formatDateForInput(new Date()));
      setScheduleTime('');
      return;
    }

    setScheduleDate(formatStoredDateForInput(data.appointment.scheduled_for));
    setScheduleTime(data.appointment.starts_at ? data.appointment.starts_at.slice(0, 5) : '');
  }, [data]);

  useEffect(() => {
    setGlobalMarginInput(data?.quote.default_material_margin_percent == null ? '' : String(data.quote.default_material_margin_percent));
  }, [data]);

  useEffect(() => {
    if (linkWarning === '1') {
      setSnack('El trabajo se creo, pero no se pudo vincular automaticamente al turno.');
    }
  }, [linkWarning]);

  const isBusy =
    save.isPending ||
    scheduleQuote.isPending ||
    deleteAppointment.isPending ||
    updateMaterial.isPending ||
    updateService.isPending ||
    deleteMaterial.isPending ||
    deleteService.isPending ||
    resetMaterialMargins.isPending ||
    isExportingPdf;

  const saveCurrentJob = async () => {
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
      setSnack('Trabajo guardado.');
    } catch (mutationError) {
      setSnack(toUserErrorMessage(mutationError, 'No se pudo guardar el trabajo.'));
    }
  };

  const exportCurrentJobPdf = async () => {
    if (!data) return;
    try {
      setIsExportingPdf(true);
      await exportQuotePdf(data);
      setSnack('PDF generado.');
    } catch (exportError) {
      setSnack(toUserErrorMessage(exportError, 'No se pudo exportar el trabajo.'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const scheduleCurrentJob = async () => {
    if (!data) return;

    try {
      const normalizedDate = normalizeDateInput(scheduleDate);
      const normalizedTime = normalizeTimeInput(scheduleTime);

      await scheduleQuote.mutateAsync({
        quote_id: data.quote.id,
        title: `${data.quote.client_name} - ${data.quote.title}`,
        notes: data.quote.notes?.trim() ? data.quote.notes.trim() : null,
        scheduled_for: normalizedDate,
        starts_at: normalizedTime,
        ends_at: null,
        status: 'scheduled',
        store_id: null,
      });

      setSnack(data.appointment ? 'Trabajo reprogramado.' : 'Trabajo programado.');
    } catch (mutationError) {
      setSnack(toUserErrorMessage(mutationError, 'No se pudo programar el trabajo.'));
    }
  };

  const unscheduleCurrentJob = async () => {
    if (!data?.appointment?.id) return;
    try {
      await deleteAppointment.mutateAsync(data.appointment.id);
      setSnack('Trabajo quitado del calendario.');
    } catch (mutationError) {
      setSnack(toUserErrorMessage(mutationError, 'No se pudo quitar el trabajo del calendario.'));
    }
  };

  const applyGlobalMargin = async () => {
    if (!data) return;

    try {
      const normalizedMargin = normalizeOptionalPercentInput(globalMarginInput);
      await save.mutateAsync({
        id: data.quote.id,
        title: data.quote.title,
        client_name: data.quote.client_name,
        default_material_margin_percent: normalizedMargin,
      });
      await resetMaterialMargins.mutateAsync(data.quote.id);
      setSnack('Margen global aplicado.');
    } catch (mutationError) {
      setSnack(toUserErrorMessage(mutationError, 'No se pudo aplicar el margen global.'));
    }
  };

  return (
    <AppScreen title="Detalle de trabajo" showHomeButton={false}>
      <LoadingOrError isLoading={isLoading} error={error} />
      {data && (
        <View style={styles.page}>
          <Text variant="titleMedium" style={styles.sectionHeading}>
            Resumen
          </Text>
          <QuoteTotalsSummary
            subtotalMaterials={data.quote.subtotal_materials}
            subtotalServices={data.quote.subtotal_services}
            total={data.quote.total}
          />

          <Card mode="contained" style={styles.sectionCard}>
            <Card.Content style={styles.sectionContent}>
              <View style={styles.actionsRow}>
                <Button
                  mode="contained"
                  icon="content-save-outline"
                  disabled={isBusy}
                  onPress={saveCurrentJob}
                  style={styles.actionButton}
                  contentStyle={styles.actionButtonContent}
                >
                  Guardar trabajo
                </Button>
                <Button
                  mode="outlined"
                  icon="share-variant-outline"
                  loading={isExportingPdf}
                  disabled={isBusy}
                  onPress={exportCurrentJobPdf}
                  style={styles.actionButton}
                  contentStyle={styles.actionButtonContent}
                >
                  Exportar / compartir PDF
                </Button>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.editingDivider}>
            <Divider />
          </View>

          <Text variant="titleMedium" style={styles.sectionHeading}>
            Cliente
          </Text>
          <Card mode="contained" style={styles.sectionCard}>
            <Card.Content style={styles.sectionContent}>
              <QuoteForm
                defaultValues={{
                  client_name: data.quote.client_name,
                  client_phone: data.quote.client_phone ?? '',
                  title: data.quote.title,
                  notes: data.quote.notes ?? '',
                }}
                buttonLabel="Guardar cliente"
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
                    setSnack('Cliente guardado.');
                  } catch (mutationError) {
                    setSnack(toUserErrorMessage(mutationError, 'No se pudo guardar el cliente.'));
                  }
                }}
              />
            </Card.Content>
          </Card>

          <Text variant="titleMedium" style={styles.sectionHeading}>
            Fecha
          </Text>
          <Card mode="contained" style={styles.sectionCard}>
            <Card.Content style={styles.sectionContent}>
              <TextInput
                mode="outlined"
                label="Fecha (DD-MM-AAAA)"
                value={scheduleDate}
                onChangeText={setScheduleDate}
                placeholder="12-03-2026"
                outlineStyle={styles.inputOutline}
              />
              <TextInput
                mode="outlined"
                label="Hora (HH:mm, opcional)"
                value={scheduleTime}
                onChangeText={setScheduleTime}
                outlineStyle={styles.inputOutline}
              />
              <View style={styles.actionsRow}>
                <Button
                  mode="contained"
                  icon="calendar-check-outline"
                  disabled={isBusy}
                  onPress={scheduleCurrentJob}
                  style={styles.actionButton}
                  contentStyle={styles.actionButtonContent}
                >
                  {data.appointment ? 'Reprogramar trabajo' : 'Programar trabajo'}
                </Button>
                {data.appointment && (
                  <Button
                    mode="outlined"
                    textColor="#B3261E"
                    disabled={isBusy}
                    onPress={unscheduleCurrentJob}
                    style={styles.actionButton}
                    contentStyle={styles.actionButtonContent}
                  >
                    Quitar del calendario
                  </Button>
                )}
                <Link href="/(tabs)/calendar" asChild>
                  <Button mode="text">Ver calendario</Button>
                </Link>
              </View>
            </Card.Content>
          </Card>

          <View style={styles.contentDivider}>
            <Divider />
          </View>

          <Text variant="titleMedium" style={styles.sectionHeading}>
            Conceptos
          </Text>
          <QuoteItemsTable
            quoteId={data.quote.id}
            services={data.services}
            materials={data.materials}
            stores={stores ?? []}
            defaultMarginPercent={data.quote.default_material_margin_percent}
            globalMarginInput={globalMarginInput}
            onGlobalMarginChange={setGlobalMarginInput}
            onApplyGlobalMargin={applyGlobalMargin}
            onSaveService={async (itemId, payload) => {
              try {
                await updateService.mutateAsync({ itemId, payload });
                setSnack('Servicio actualizado.');
              } catch (mutationError) {
                setSnack(toUserErrorMessage(mutationError, 'No se pudo actualizar el servicio.'));
              }
            }}
            onDeleteService={(itemId) => setDeleteTarget({ kind: 'service', id: itemId })}
            onSaveMaterial={async (itemId, payload) => {
              try {
                await updateMaterial.mutateAsync({ itemId, payload });
                setSnack('Material actualizado.');
              } catch (mutationError) {
                setSnack(toUserErrorMessage(mutationError, 'No se pudo actualizar el material.'));
              }
            }}
            onDeleteMaterial={(itemId) => setDeleteTarget({ kind: 'material', id: itemId })}
            isBusy={isBusy}
            isApplyingGlobalMargin={save.isPending || resetMaterialMargins.isPending}
            savingService={updateService.isPending}
            deletingService={deleteService.isPending}
            savingMaterial={updateMaterial.isPending}
            deletingMaterial={deleteMaterial.isPending}
          />

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
        message="Seguro que queres eliminar esta linea del trabajo?"
        loading={deleteMaterial.isPending || deleteService.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            if (deleteTarget.kind === 'material') {
              await deleteMaterial.mutateAsync(deleteTarget.id);
              setSnack('Material eliminado.');
            } else {
              await deleteService.mutateAsync(deleteTarget.id);
              setSnack('Servicio eliminado.');
            }
            setDeleteTarget(null);
          } catch (mutationError) {
            setSnack(toUserErrorMessage(mutationError, 'No se pudo eliminar la linea.'));
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
  sectionHeading: {
    marginBottom: -6,
  },
  editingDivider: {
    marginTop: 2,
    marginBottom: -2,
  },
  contentDivider: {
    marginTop: 4,
    marginBottom: -2,
  },
  inputOutline: {
    borderRadius: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionButton: {
    borderRadius: 10,
    flexGrow: 1,
    minWidth: 170,
  },
  actionButtonContent: {
    minHeight: 40,
    paddingHorizontal: 8,
  },
});
