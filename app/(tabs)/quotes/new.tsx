import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems } from '@/features/items/hooks';
import { useLatestPrices } from '@/features/prices/hooks';
import { QuoteForm } from '@/features/quotes/QuoteForm';
import { LinkedAppointmentCard } from '@/features/quotes/newQuote/LinkedAppointmentCard';
import { MaterialsDraftSection } from '@/features/quotes/newQuote/MaterialsDraftSection';
import { ScheduleDateSection } from '@/features/quotes/newQuote/ScheduleDateSection';
import { ServicesDraftSection } from '@/features/quotes/newQuote/ServicesDraftSection';
import { useMaterialDraft } from '@/features/quotes/newQuote/useMaterialDraft';
import { useQuoteSaveWorkflow } from '@/features/quotes/newQuote/useQuoteSaveWorkflow';
import { useScheduleDate } from '@/features/quotes/newQuote/useScheduleDate';
import { useServiceDraft } from '@/features/quotes/newQuote/useServiceDraft';
import { useServices } from '@/features/services/hooks';
import { useStores } from '@/features/stores/hooks';
import { getSingleRouteParam } from '@/lib/routeParams';

export default function NewQuotePage() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    appointmentId?: string | string[];
    scheduledFor?: string | string[];
    startsAt?: string | string[];
    title?: string | string[];
    notes?: string | string[];
  }>();

  const appointmentId = getSingleRouteParam(params.appointmentId).trim();
  const scheduledFor = getSingleRouteParam(params.scheduledFor).trim();
  const startsAt = getSingleRouteParam(params.startsAt).trim();
  const appointmentTitle = getSingleRouteParam(params.title).trim();
  const appointmentNotes = getSingleRouteParam(params.notes).trim();
  const hasLinkedAppointment = Boolean(appointmentId);

  const [message, setMessage] = useState<string | null>(null);
  useToastMessageEffect(message, () => setMessage(null));

  // Remote data
  const { data: services, isLoading: servicesLoading, error: servicesError } = useServices();
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const latestPricesQuery = useLatestPrices();

  // Feature hooks
  const schedule = useScheduleDate({ scheduledFor, startsAt, hasLinkedAppointment });

  const serviceDraft = useServiceDraft({ services, onError: setMessage });

  const materialDraft = useMaterialDraft({
    items,
    stores,
    latestPricesData: latestPricesQuery.data,
    onError: setMessage,
  });

  const saveWorkflow = useQuoteSaveWorkflow({
    draftServices: serviceDraft.draftServices,
    draftMaterials: materialDraft.draftMaterials,
    scheduleDate: schedule.scheduleDate,
    scheduleTime: schedule.scheduleTime,
    hasLinkedAppointment,
    appointmentId,
    queryClient,
    onError: setMessage,
  });

  const busy = saveWorkflow.isSaving;

  const rawCatalogError =
    servicesError ??
    itemsError ??
    storesError ??
    latestPricesQuery.error ??
    materialDraft.extraDataError ??
    null;
  const catalogError =
    rawCatalogError instanceof Error
      ? rawCatalogError
      : rawCatalogError
        ? new Error('No se pudieron cargar los datos del formulario.')
        : null;

  const catalogsLoading =
    servicesLoading ||
    itemsLoading ||
    storesLoading ||
    latestPricesQuery.isLoading ||
    materialDraft.isLoadingExtraData;

  return (
    <AppScreen title="Nuevo trabajo">
      <LoadingOrError isLoading={catalogsLoading} error={catalogError} />

      {hasLinkedAppointment ? (
        <LinkedAppointmentCard scheduledFor={scheduledFor} startsAt={startsAt} />
      ) : null}

      <Card mode="outlined" style={styles.formCard}>
        <Card.Content style={styles.formCardContent}>
          <QuoteForm
            defaultValues={{
              title: appointmentTitle,
              notes: appointmentNotes,
            }}
            disabled={busy}
            extraContent={
              <View style={styles.extraSections}>
                {!hasLinkedAppointment ? (
                  <ScheduleDateSection
                    scheduleDate={schedule.scheduleDate}
                    setScheduleDate={schedule.setScheduleDate}
                    scheduleTime={schedule.scheduleTime}
                    setScheduleTime={schedule.setScheduleTime}
                    calendarVisible={schedule.calendarVisible}
                    setCalendarVisible={schedule.setCalendarVisible}
                    disabled={busy}
                  />
                ) : null}

                <ServicesDraftSection
                  serviceSearch={serviceDraft.serviceSearch}
                  setServiceSearch={serviceDraft.setServiceSearch}
                  selectedService={serviceDraft.selectedService}
                  filteredServices={serviceDraft.filteredServices}
                  selectService={serviceDraft.selectService}
                  clearSelectedService={serviceDraft.clearSelectedService}
                  serviceQuantityInput={serviceDraft.serviceQuantityInput}
                  setServiceQuantityInput={serviceDraft.setServiceQuantityInput}
                  serviceUnitPriceInput={serviceDraft.serviceUnitPriceInput}
                  setServiceUnitPriceInput={serviceDraft.setServiceUnitPriceInput}
                  serviceNotesInput={serviceDraft.serviceNotesInput}
                  setServiceNotesInput={serviceDraft.setServiceNotesInput}
                  summaryRows={serviceDraft.summaryRows}
                  previewTotal={serviceDraft.previewTotal}
                  addDraftService={serviceDraft.addDraftService}
                  removeDraftService={serviceDraft.removeDraftService}
                  disabled={busy}
                />

                <MaterialsDraftSection
                  storeSearch={materialDraft.storeSearch}
                  setStoreSearch={materialDraft.setStoreSearch}
                  selectedStore={materialDraft.selectedStore}
                  setSelectedStoreId={materialDraft.setSelectedStoreId}
                  filteredStores={materialDraft.filteredStores}
                  selectedStoreId={materialDraft.selectedStoreId}
                  materialSearch={materialDraft.materialSearch}
                  setMaterialSearch={materialDraft.setMaterialSearch}
                  selectedItem={materialDraft.selectedItem}
                  selectedItemId={materialDraft.selectedItemId}
                  selectItem={materialDraft.selectItem}
                  clearSelectedItem={materialDraft.clearSelectedItem}
                  filteredItems={materialDraft.filteredItems}
                  directPriceByItemId={materialDraft.directPriceByItemId}
                  measuredItemIds={materialDraft.measuredItemIds}
                  selectedMeasurementId={materialDraft.selectedMeasurementId}
                  selectedMeasurement={materialDraft.selectedMeasurement}
                  selectMeasurement={materialDraft.selectMeasurement}
                  itemMeasurements={materialDraft.itemMeasurements}
                  hasMeasurements={materialDraft.hasMeasurements}
                  measurePriceByMeasurementId={materialDraft.measurePriceByMeasurementId}
                  materialQuantityInput={materialDraft.materialQuantityInput}
                  setMaterialQuantityInput={materialDraft.setMaterialQuantityInput}
                  materialUnitPriceInput={materialDraft.materialUnitPriceInput}
                  setMaterialUnitPriceInput={materialDraft.setMaterialUnitPriceInput}
                  materialNotesInput={materialDraft.materialNotesInput}
                  setMaterialNotesInput={materialDraft.setMaterialNotesInput}
                  summaryRows={materialDraft.summaryRows}
                  previewTotal={materialDraft.previewTotal}
                  addDraftMaterial={materialDraft.addDraftMaterial}
                  removeDraftMaterial={materialDraft.removeDraftMaterial}
                  disabled={busy}
                />
              </View>
            }
            onSubmit={saveWorkflow.handleSubmit}
          />
        </Card.Content>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderRadius: 12,
  },
  formCardContent: {
    gap: 14,
    paddingVertical: 8,
  },
  extraSections: {
    gap: 14,
  },
});
