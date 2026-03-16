import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Card, Divider, IconButton, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useAppointmentsInMonth, useDeleteAppointment, useUpsertQuoteAppointment } from '@/features/appointments/hooks';
import { ConfirmDeleteDialog } from '@/features/quotes/components/ConfirmDeleteDialog';
import { QuoteItemsTable } from '@/features/quotes/components/QuoteItemsTable';
import { QuoteTotalsSummary } from '@/features/quotes/components/QuoteTotalsSummary';
import { saveQuotePdf, shareQuotePdf } from '@/features/quotes/exportPdf';
import { QuoteForm } from '@/features/quotes/QuoteForm';
import {
  useDeleteQuoteMaterialItem,
  useDeleteQuoteServiceItem,
  useRefreshQuoteMaterialPricing,
  useQuoteDetail,
  useSaveQuote,
  useUpdateQuoteStatus,
  useUpdateQuoteMaterialItem,
  useUpdateQuoteServiceItem,
} from '@/features/quotes/hooks';
import { normalizeQuoteStatus, quoteStatusAccent, quoteStatusLabel } from '@/features/quotes/status';
import { useStores } from '@/features/stores/hooks';
import {
  formatDisplayDate,
  formatIsoDate,
  formatStoredDateForDisplay,
  getCalendarCells,
  maskDateInput,
  maskTimeInput,
  monthLabel,
  normalizeDateInput,
  normalizeOptionalTimeInput,
  parseDisplayDate,
  toHumanDate,
} from '@/lib/dateTimeInput';
import { toUserErrorMessage } from '@/lib/errors';
import { formatDateAr, formatTimeShort } from '@/lib/format';
import { BRAND_BLUE, BRAND_BLUE_MID, BRAND_BLUE_SOFT, useAppTheme } from '@/theme';
import type { JobQuoteStatus } from '@/types/db';

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const STATUS_OPTIONS: Array<{ value: JobQuoteStatus; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'completed', label: 'Terminado' },
  { value: 'cancelled', label: 'Cancelado' },
];

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
  const theme = useAppTheme();
  const { id, linkWarning } = useLocalSearchParams<{ id: string; linkWarning?: string }>();
  const { data, isLoading, error } = useQuoteDetail(id);
  const referencedStoreIds = useMemo(
    () => Array.from(new Set((data?.materials ?? []).map((item) => item.source_store_id).filter(Boolean) as string[])).sort(),
    [data?.materials],
  );
  const { data: stores } = useStores(referencedStoreIds);
  const save = useSaveQuote();
  const updateStatus = useUpdateQuoteStatus();
  const scheduleQuote = useUpsertQuoteAppointment();
  const deleteAppointment = useDeleteAppointment();
  const updateMaterial = useUpdateQuoteMaterialItem();
  const updateService = useUpdateQuoteServiceItem();
  const deleteMaterial = useDeleteQuoteMaterialItem();
  const deleteService = useDeleteQuoteServiceItem();
  const refreshMaterialPricing = useRefreshQuoteMaterialPricing();

  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(formatDisplayDate(new Date()));
  const [scheduleTime, setScheduleTime] = useState('');
  const [globalMarginInput, setGlobalMarginInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'material' | 'service'; id: string } | null>(null);
  const [calendarVisible, setCalendarVisible] = useState(false);
  useToastMessageEffect(snack, () => setSnack(null));
  const [calendarMonthAnchor, setCalendarMonthAnchor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(() => formatIsoDate(new Date()));

  const monthAppointments = useAppointmentsInMonth(calendarMonthAnchor);

  useEffect(() => {
    if (!data) return;
    if (!data.appointment) {
      setScheduleDate(formatDisplayDate(new Date()));
      setScheduleTime('');
      return;
    }

    setScheduleDate(formatStoredDateForDisplay(data.appointment.scheduled_for));
    setScheduleTime(data.appointment.starts_at ? data.appointment.starts_at.slice(0, 5) : '');
  }, [data]);

  useEffect(() => {
    setGlobalMarginInput(data?.quote.default_material_margin_percent == null ? '' : String(data.quote.default_material_margin_percent));
  }, [data]);

  useEffect(() => {
    const parsedDate = parseDisplayDate(scheduleDate);
    if (!parsedDate) return;

    const nextSelectedDate = formatIsoDate(parsedDate);
    setCalendarSelectedDate((current) => (current === nextSelectedDate ? current : nextSelectedDate));

    const nextAnchor = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
    setCalendarMonthAnchor((current) =>
      current.getFullYear() === nextAnchor.getFullYear() && current.getMonth() === nextAnchor.getMonth() ? current : nextAnchor,
    );
  }, [scheduleDate]);

  useEffect(() => {
    if (linkWarning === '1') {
      setSnack('El trabajo se creo, pero no se pudo vincular automaticamente al turno.');
    }
  }, [linkWarning]);

  const calendarCells = useMemo(() => getCalendarCells(calendarMonthAnchor), [calendarMonthAnchor]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, number>();
    (monthAppointments.data ?? []).forEach((appointment) => {
      map.set(appointment.scheduled_for, (map.get(appointment.scheduled_for) ?? 0) + 1);
    });
    return map;
  }, [monthAppointments.data]);

  const selectedDateAppointments = useMemo(
    () =>
      (monthAppointments.data ?? [])
        .filter((appointment) => appointment.scheduled_for === calendarSelectedDate)
        .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? '')),
    [calendarSelectedDate, monthAppointments.data],
  );

  const currentStatus = normalizeQuoteStatus(data?.quote.status);
  const currentStatusAccent = quoteStatusAccent(data?.quote.status);
  const cancelledAutoDeleteDate = useMemo(() => {
    if (!data?.quote.cancelled_at || currentStatus !== 'cancelled') return null;
    const nextDate = new Date(data.quote.cancelled_at);
    nextDate.setDate(nextDate.getDate() + 3);
    return formatDateAr(nextDate.toISOString());
  }, [currentStatus, data?.quote.cancelled_at]);

  const isBusy =
    save.isPending ||
    updateStatus.isPending ||
    scheduleQuote.isPending ||
    deleteAppointment.isPending ||
    updateMaterial.isPending ||
    updateService.isPending ||
    deleteMaterial.isPending ||
    deleteService.isPending ||
    refreshMaterialPricing.isPending ||
    isSavingPdf ||
    isSharingPdf;

  const saveCurrentJob = async () => {
    if (!data) return;
    try {
      await save.mutateAsync({
        id: data.quote.id,
        title: data.quote.title,
        client_name: data.quote.client_name,
        client_phone: data.quote.client_phone,
        notes: data.quote.notes,
      });
      setSnack('Trabajo guardado.');
    } catch (mutationError) {
      setSnack(toUserErrorMessage(mutationError, 'No se pudo guardar el trabajo.'));
    }
  };

  const changeQuoteStatus = async (nextStatus: JobQuoteStatus) => {
    if (!data || currentStatus === nextStatus) return;

    try {
      await updateStatus.mutateAsync({ quoteId: data.quote.id, status: nextStatus });
      if (nextStatus === 'completed') {
        setSnack('Trabajo marcado como terminado.');
      } else if (nextStatus === 'cancelled') {
        setSnack('Trabajo cancelado.');
      } else {
        setSnack('Trabajo marcado como pendiente.');
      }
    } catch (mutationError) {
      setSnack(toUserErrorMessage(mutationError, 'No se pudo actualizar el estado del trabajo.'));
    }
  };

  const saveCurrentJobPdf = async () => {
    if (!data) return;
    try {
      setIsSavingPdf(true);
      await saveQuotePdf(data);
      setSnack(Platform.OS === 'android' ? 'PDF guardado en la carpeta seleccionada.' : 'PDF guardado.');
    } catch (exportError) {
      setSnack(toUserErrorMessage(exportError, 'No se pudo guardar el PDF.'));
    } finally {
      setIsSavingPdf(false);
    }
  };

  const shareCurrentJobPdf = async () => {
    if (!data) return;
    try {
      setIsSharingPdf(true);
      await shareQuotePdf(data);
    } catch (exportError) {
      setSnack(toUserErrorMessage(exportError, 'No se pudo compartir el PDF.'));
    } finally {
      setIsSharingPdf(false);
    }
  };

  const scheduleCurrentJob = async () => {
    if (!data) return;

    try {
      const normalizedDate = normalizeDateInput(scheduleDate);
      const normalizedTime = normalizeOptionalTimeInput(scheduleTime);

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
      await refreshMaterialPricing.mutateAsync(data.quote.id);
      setSnack('Margen global aplicado.');
    } catch (mutationError) {
      setSnack(toUserErrorMessage(mutationError, 'No se pudo aplicar el margen global.'));
    }
  };

  const toggleInlineCalendar = () => {
    setCalendarVisible((current) => !current);
  };

  const moveCalendarMonth = (delta: number) => {
    const nextAnchor = new Date(calendarMonthAnchor.getFullYear(), calendarMonthAnchor.getMonth() + delta, 1);
    setCalendarMonthAnchor(nextAnchor);
    const nextDate = formatIsoDate(nextAnchor);
    setCalendarSelectedDate(nextDate);
    setScheduleDate(formatDisplayDate(nextAnchor));
  };

  const handleCalendarDateSelect = (isoDate: string) => {
    const [rawYear = '1970', rawMonth = '01', rawDay = '01'] = isoDate.split('-');
    const year = Number(rawYear);
    const month = Number(rawMonth);
    const day = Number(rawDay);
    const nextDate = new Date(
      Number.isFinite(year) ? year : 1970,
      Number.isFinite(month) ? month - 1 : 0,
      Number.isFinite(day) ? day : 1,
    );

    setCalendarSelectedDate(isoDate);
    setScheduleDate(formatDisplayDate(nextDate));
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
                <View style={styles.pdfActionsGroup}>
                  <View style={[styles.pdfSplitButton, isBusy && styles.pdfSplitButtonDisabled]}>
                    <Pressable
                      onPress={saveCurrentJobPdf}
                      disabled={isBusy}
                      style={({ pressed }) => [styles.pdfSplitAction, pressed && styles.pdfSplitActionPressed]}
                    >
                      {isSavingPdf ? (
                        <ActivityIndicator size={16} color={styles.pdfSplitActionText.color} />
                      ) : (
                        <IconButton icon="file-pdf-box" size={16} iconColor={styles.pdfSplitActionText.color} style={styles.pdfSplitIcon} />
                      )}
                      <Text style={styles.pdfSplitActionText}>Descargar</Text>
                    </Pressable>
                    <View style={styles.pdfSplitDivider} />
                    <Pressable
                      onPress={shareCurrentJobPdf}
                      disabled={isBusy}
                      style={({ pressed }) => [styles.pdfSplitAction, pressed && styles.pdfSplitActionPressed]}
                    >
                      {isSharingPdf ? (
                        <ActivityIndicator size={16} color={styles.pdfSplitActionText.color} />
                      ) : (
                        <IconButton icon="share-variant-outline" size={16} iconColor={styles.pdfSplitActionText.color} style={styles.pdfSplitIcon} />
                      )}
                      <Text style={styles.pdfSplitActionText}>Compartir</Text>
                    </Pressable>
                  </View>
                </View>
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
                onChangeText={(value) => setScheduleDate(maskDateInput(value))}
                placeholder="12-03-2026"
                keyboardType="number-pad"
                maxLength={10}
                outlineStyle={styles.inputOutline}
                right={<TextInput.Icon icon="calendar-month-outline" onPress={toggleInlineCalendar} />}
              />
              <TextInput
                mode="outlined"
                label="Hora (HH:mm, opcional)"
                value={scheduleTime}
                onChangeText={(value) => setScheduleTime(maskTimeInput(value))}
                placeholder="09:30"
                keyboardType="number-pad"
                maxLength={5}
                outlineStyle={styles.inputOutline}
              />
              {calendarVisible ? (
                <Card mode="contained" style={styles.inlineCalendarCard}>
                  <Card.Content style={styles.inlineCalendarContent}>
                    <View style={styles.inlineCalendarHeader}>
                      <Text variant="titleMedium" style={styles.inlineCalendarMonthLabel}>
                        {monthLabel(calendarMonthAnchor)}
                      </Text>
                      <View style={styles.inlineCalendarNav}>
                        <IconButton
                          icon="arrow-left"
                          size={18}
                          accessibilityLabel="Mes anterior"
                          onPress={() => moveCalendarMonth(-1)}
                          style={styles.inlineCalendarNavButton}
                        />
                        <IconButton
                          icon="arrow-right"
                          size={18}
                          accessibilityLabel="Mes siguiente"
                          onPress={() => moveCalendarMonth(1)}
                          style={styles.inlineCalendarNavButton}
                        />
                      </View>
                    </View>

                    <View style={styles.inlineCalendarWeekHeader}>
                      {WEEKDAY_LABELS.map((label) => (
                        <Text key={label} style={styles.inlineCalendarWeekLabel}>
                          {label}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.inlineCalendarGrid}>
                      {calendarCells.map((day, index) => {
                        const dateKey = day == null ? null : formatIsoDate(new Date(calendarMonthAnchor.getFullYear(), calendarMonthAnchor.getMonth(), day));
                        const selected = dateKey != null && dateKey === calendarSelectedDate;
                        const markers = dateKey != null ? Math.min(appointmentsByDate.get(dateKey) ?? 0, 3) : 0;

                        return (
                          <View key={`quote-calendar-day-${index}-${day ?? 'empty'}`} style={styles.inlineCalendarDayCell}>
                            {dateKey ? (
                              <Pressable
                                onPress={() => handleCalendarDateSelect(dateKey)}
                                style={({ pressed }) => [styles.inlineCalendarDayPressable, pressed && styles.inlineCalendarDayPressed]}
                              >
                                <View style={[styles.inlineCalendarDayBubble, selected && styles.inlineCalendarDayBubbleSelected]}>
                                  <Text style={[styles.inlineCalendarDayNumber, selected && styles.inlineCalendarDayNumberSelected]}>{day}</Text>
                                </View>
                                <View style={styles.inlineCalendarMarkersRow}>
                                  {Array.from({ length: markers }).map((_, markerIndex) => (
                                    <View
                                      key={`${dateKey}-quote-marker-${markerIndex}`}
                                      style={[styles.inlineCalendarMarker, selected && styles.inlineCalendarMarkerSelected]}
                                    />
                                  ))}
                                </View>
                              </Pressable>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.inlineAgendaBlock}>
                      <Text variant="titleSmall" style={styles.inlineAgendaTitle}>
                        Trabajos del {toHumanDate(calendarSelectedDate)}
                      </Text>
                      {monthAppointments.isLoading ? (
                        <Text style={styles.inlineAgendaHint}>Cargando trabajos...</Text>
                      ) : selectedDateAppointments.length === 0 ? (
                        <Text style={styles.inlineAgendaHint}>No hay trabajos con turno ese dia.</Text>
                      ) : (
                        <View style={styles.inlineAgendaList}>
                          {selectedDateAppointments.map((appointment) => (
                            <View key={appointment.id} style={styles.inlineAgendaItem}>
                              <Text style={styles.inlineAgendaTime}>{appointment.starts_at ? formatTimeShort(appointment.starts_at) : 'Sin hora'}</Text>
                              <Text style={styles.inlineAgendaText} numberOfLines={1}>
                                {appointment.title}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              ) : null}
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
            isApplyingGlobalMargin={save.isPending || refreshMaterialPricing.isPending}
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

          <Card mode="contained" style={styles.sectionCard}>
            <Card.Content style={styles.statusCardContent}>
              <View style={styles.statusHeaderRow}>
                <View style={styles.statusHeadingBlock}>
                  <Text variant="titleMedium" style={[styles.sectionHeading, styles.statusTitle]}>
                    Estado
                  </Text>
                  {cancelledAutoDeleteDate ? (
                    <Text style={[styles.statusDescription, { color: theme.colors.error }]}>
                      Se elimina automaticamente el {cancelledAutoDeleteDate} si sigue cancelado.
                    </Text>
                  ) : null}
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: currentStatusAccent.backgroundColor,
                      borderColor: currentStatusAccent.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: currentStatusAccent.textColor }]}>{quoteStatusLabel(data.quote.status)}</Text>
                </View>
              </View>

              <View style={styles.statusOptionsRow}>
                {STATUS_OPTIONS.map((option) => {
                  const optionAccent = quoteStatusAccent(option.value);
                  const selected = currentStatus === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => changeQuoteStatus(option.value)}
                      disabled={isBusy}
                      style={({ pressed }) => [
                        styles.statusOption,
                        selected && {
                          backgroundColor: optionAccent.backgroundColor,
                          borderColor: optionAccent.borderColor,
                        },
                        pressed && styles.statusOptionPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusOptionText,
                          selected && {
                            color: optionAccent.textColor,
                          },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card.Content>
          </Card>
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
  statusCardContent: {
    gap: 14,
    paddingVertical: 10,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE4EC',
  },
  sectionHeading: {
    flex: 1,
    marginBottom: 0,
  },
  statusTitle: {
    flexGrow: 0,
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
  pdfActionsGroup: {
    flex: 1,
    minWidth: 240,
  },
  pdfSplitButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderWidth: 1,
    borderColor: '#BCC6D1',
    borderRadius: 10,
    backgroundColor: '#F7FAFD',
    overflow: 'hidden',
  },
  pdfSplitButtonDisabled: {
    opacity: 0.68,
  },
  pdfSplitAction: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  pdfSplitActionPressed: {
    backgroundColor: '#EEF3F8',
  },
  pdfSplitDivider: {
    width: 1,
    backgroundColor: '#D7DFE8',
  },
  pdfSplitIcon: {
    margin: 0,
    width: 18,
    height: 18,
  },
  pdfSplitActionText: {
    color: '#052653',
    fontWeight: '500',
  },
  actionButtonContent: {
    minHeight: 40,
    paddingHorizontal: 8,
  },
  statusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusHeadingBlock: {
    flex: 1,
    gap: 4,
  },
  statusDescription: {
    color: '#5F6A76',
    fontSize: 13,
    lineHeight: 18,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  statusOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  statusOption: {
    minWidth: 118,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E0EA',
    backgroundColor: '#FFFFFF',
  },
  statusOptionPressed: {
    opacity: 0.78,
  },
  statusOptionText: {
    color: '#213243',
    fontWeight: '600',
    textAlign: 'center',
  },
  inlineCalendarCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(5, 38, 83, 0.08)',
    backgroundColor: '#F7FAFD',
  },
  inlineCalendarContent: {
    gap: 12,
    paddingVertical: 8,
  },
  inlineCalendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  inlineCalendarMonthLabel: {
    flex: 1,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  inlineCalendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inlineCalendarNavButton: {
    margin: 0,
  },
  inlineCalendarWeekHeader: {
    flexDirection: 'row',
  },
  inlineCalendarWeekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontWeight: '600',
    color: '#617082',
  },
  inlineCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  inlineCalendarDayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
  },
  inlineCalendarDayPressable: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 2,
  },
  inlineCalendarDayPressed: {
    opacity: 0.76,
  },
  inlineCalendarDayBubble: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineCalendarDayBubbleSelected: {
    backgroundColor: BRAND_BLUE_SOFT,
  },
  inlineCalendarDayNumber: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
    color: '#164E63',
  },
  inlineCalendarDayNumberSelected: {
    fontWeight: '700',
    color: BRAND_BLUE,
  },
  inlineCalendarMarkersRow: {
    minHeight: 8,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  inlineCalendarMarker: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: BRAND_BLUE,
  },
  inlineCalendarMarkerSelected: {
    backgroundColor: BRAND_BLUE_MID,
  },
  inlineAgendaBlock: {
    gap: 8,
    paddingTop: 2,
  },
  inlineAgendaTitle: {
    fontWeight: '600',
  },
  inlineAgendaHint: {
    color: '#5f6368',
  },
  inlineAgendaList: {
    gap: 8,
  },
  inlineAgendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE4EC',
  },
  inlineAgendaTime: {
    width: 62,
    fontWeight: '700',
    color: BRAND_BLUE,
  },
  inlineAgendaText: {
    flex: 1,
    color: '#1F2937',
  },
});
