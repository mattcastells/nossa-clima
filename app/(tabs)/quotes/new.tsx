import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Searchbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { CalendarPickerDialog } from '@/components/CalendarPickerDialog';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useLinkAppointmentToQuote, useUpsertQuoteAppointment } from '@/features/appointments/hooks';
import { useItemMeasurements, useItems } from '@/features/items/hooks';
import { useLatestMeasurePrices, useLatestPrices } from '@/features/prices/hooks';
import { QuoteForm } from '@/features/quotes/QuoteForm';
import { QuoteItemsSummary, type SummaryRow } from '@/features/quotes/components/QuoteItemsSummary';
import { getMaterialEffectiveTotalPrice } from '@/features/quotes/materialPricing';
import { useServices } from '@/features/services/hooks';
import { useStores } from '@/features/stores/hooks';
import { maskDateInput, maskTimeInput, normalizeDateInput, normalizeOptionalTimeInput } from '@/lib/dateTimeInput';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs, formatDateAr, formatTimeShort } from '@/lib/format';
import { formatItemDisplayName, formatMeasurementDisplayLabel, formatMeasuredItemDisplayName } from '@/lib/itemDisplay';
import { getSingleRouteParam } from '@/lib/routeParams';
import { addQuoteMaterialItem, addQuoteServiceItem, deleteQuote as deleteQuoteById, upsertQuote } from '@/services/quotes';
import { BRAND_BLUE, BRAND_BLUE_SOFT, BRAND_GREEN, BRAND_GREEN_SOFT, useAppTheme } from '@/theme';

type DraftServiceLine = {
  id: string;
  service_id: string;
  label: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  total_price: number;
};

type DraftMaterialLine = {
  id: string;
  item_id: string;
  item_measurement_id: string | null;
  label: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  source_store_id: string | null;
  source_store_name: string | null;
  notes: string | null;
  total_price: number;
};

const createDraftId = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parsePositiveInput = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
};

const parseNonNegativeInput = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Number(parsed.toFixed(2)) : null;
};

export default function NewQuotePage() {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    appointmentId?: string | string[];
    scheduledFor?: string | string[];
    startsAt?: string | string[];
    title?: string | string[];
    notes?: string | string[];
  }>();
  const linkAppointment = useLinkAppointmentToQuote();
  const scheduleQuote = useUpsertQuoteAppointment();
  const { data: services, isLoading: servicesLoading, error: servicesError } = useServices();
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const latestPricesQuery = useLatestPrices();
  const [message, setMessage] = useState<string | null>(null);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));

  const appointmentId = getSingleRouteParam(params.appointmentId).trim();
  const scheduledFor = getSingleRouteParam(params.scheduledFor).trim();
  const startsAt = getSingleRouteParam(params.startsAt).trim();
  const appointmentTitle = getSingleRouteParam(params.title).trim();
  const appointmentNotes = getSingleRouteParam(params.notes).trim();
  const hasLinkedAppointment = Boolean(appointmentId);

  const [calendarVisible, setCalendarVisible] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceQuantityInput, setServiceQuantityInput] = useState('1');
  const [serviceUnitPriceInput, setServiceUnitPriceInput] = useState('');
  const [serviceNotesInput, setServiceNotesInput] = useState('');
  const [draftServices, setDraftServices] = useState<DraftServiceLine[]>([]);

  const [storeSearch, setStoreSearch] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [materialQuantityInput, setMaterialQuantityInput] = useState('1');
  const [materialUnitPriceInput, setMaterialUnitPriceInput] = useState('');
  const [materialNotesInput, setMaterialNotesInput] = useState('');
  const [draftMaterials, setDraftMaterials] = useState<DraftMaterialLine[]>([]);

  const latestMeasurePricesQuery = useLatestMeasurePrices(selectedStoreId ? { storeId: selectedStoreId } : {});
  const { data: measurements, isLoading: measurementsLoading, error: measurementsError } = useItemMeasurements(selectedItemId);

  const busy = isSavingWorkflow || linkAppointment.isPending || scheduleQuote.isPending;
  const selectedService = (services ?? []).find((service) => service.id === selectedServiceId) ?? null;
  const materialItems = useMemo(
    () => (items ?? []).filter((item) => item.item_type === 'material').sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );
  const selectedStore = (stores ?? []).find((store) => store.id === selectedStoreId) ?? null;
  const selectedItem = materialItems.find((item) => item.id === selectedItemId) ?? null;
  const itemMeasurements = useMemo(() => measurements ?? [], [measurements]);
  const selectedMeasurement = itemMeasurements.find((measurement) => measurement.id === selectedMeasurementId) ?? null;
  const hasMeasurements = itemMeasurements.length > 0;

  const rawCatalogError =
    servicesError ??
    itemsError ??
    storesError ??
    latestPricesQuery.error ??
    latestMeasurePricesQuery.error ??
    measurementsError ??
    null;
  const catalogError = rawCatalogError instanceof Error ? rawCatalogError : rawCatalogError ? new Error('No se pudieron cargar los datos del formulario.') : null;
  const catalogsLoading =
    servicesLoading ||
    itemsLoading ||
    storesLoading ||
    latestPricesQuery.isLoading ||
    (Boolean(selectedStoreId) && latestMeasurePricesQuery.isLoading) ||
    (Boolean(selectedItemId) && measurementsLoading);

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    return (services ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(
        (service) =>
          !query ||
          service.name.toLowerCase().includes(query) ||
          (service.category ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [serviceSearch, services]);

  const filteredStores = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();
    return (stores ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(
        (store) =>
          !query ||
          store.name.toLowerCase().includes(query) ||
          (store.address ?? '').toLowerCase().includes(query) ||
          (store.description ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [storeSearch, stores]);

  const storeBaseRows = useMemo(
    () => (latestPricesQuery.data ?? []).filter((row) => row.store_id === selectedStoreId),
    [latestPricesQuery.data, selectedStoreId],
  );
  const storeMeasureRows = useMemo(
    () => (selectedStoreId ? (latestMeasurePricesQuery.data ?? []).filter((row) => row.store_id === selectedStoreId) : []),
    [latestMeasurePricesQuery.data, selectedStoreId],
  );
  const directPriceByItemId = useMemo(() => new Map(storeBaseRows.map((row) => [row.item_id, Number(row.price)] as const)), [storeBaseRows]);
  const measurePriceByMeasurementId = useMemo(
    () => new Map(storeMeasureRows.map((row) => [row.item_measurement_id, Number(row.price)] as const)),
    [storeMeasureRows],
  );
  const measuredItemIds = useMemo(() => new Set(storeMeasureRows.map((row) => row.item_id)), [storeMeasureRows]);
  const directItemIds = useMemo(() => new Set(storeBaseRows.map((row) => row.item_id)), [storeBaseRows]);

  const filteredItems = useMemo(() => {
    if (!selectedStoreId) return [];

    const query = materialSearch.trim().toLowerCase();
    return materialItems
      .filter((item) => directItemIds.has(item.id) || measuredItemIds.has(item.id))
      .filter(
        (item) =>
          !query ||
          item.name.toLowerCase().includes(query) ||
          (item.category ?? '').toLowerCase().includes(query) ||
          (item.base_price_label ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [directItemIds, materialItems, materialSearch, measuredItemIds, selectedStoreId]);

  const serviceSummaryRows: SummaryRow[] = useMemo(
    () =>
      draftServices.map((service) => ({
        id: service.id,
        label: service.label,
        quantityLabel: String(service.quantity),
        unitPrice: service.unit_price,
        totalPrice: service.total_price,
      })),
    [draftServices],
  );

  const materialSummaryRows: SummaryRow[] = useMemo(
    () =>
      draftMaterials.map((material) => ({
        id: material.id,
        label: material.source_store_name ? `${material.label} - ${material.source_store_name}` : material.label,
        quantityLabel: `${material.quantity}${material.unit ? ` ${material.unit}` : ''}`,
        unitPrice: material.unit_price,
        totalPrice: material.total_price,
      })),
    [draftMaterials],
  );

  const servicePreviewTotal = useMemo(() => {
    const quantity = parsePositiveInput(serviceQuantityInput) ?? 0;
    const unitPrice = parseNonNegativeInput(serviceUnitPriceInput) ?? 0;
    return Number((quantity * unitPrice).toFixed(2));
  }, [serviceQuantityInput, serviceUnitPriceInput]);

  const materialPreviewTotal = useMemo(() => {
    const quantity = parsePositiveInput(materialQuantityInput) ?? 0;
    const unitPrice = parseNonNegativeInput(materialUnitPriceInput) ?? 0;
    return getMaterialEffectiveTotalPrice(quantity, unitPrice, null, null);
  }, [materialQuantityInput, materialUnitPriceInput]);

  useEffect(() => {
    if (hasLinkedAppointment || !scheduledFor) return;
    const [year = '', month = '', day = ''] = scheduledFor.split('-');
    if (year && month && day) {
      setScheduleDate(`${day}-${month}-${year}`);
    }
    setScheduleTime(startsAt ? startsAt.slice(0, 5) : '');
  }, [hasLinkedAppointment, scheduledFor, startsAt]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedMeasurementId(null);
      setMaterialUnitPriceInput('');
      return;
    }

    if (itemMeasurements.length === 0) {
      setSelectedMeasurementId(null);
      const directPrice = directPriceByItemId.get(selectedItem.id);
      setMaterialUnitPriceInput(directPrice != null ? String(directPrice) : '');
      return;
    }

    const nextMeasurement =
      itemMeasurements.find((measurement) => measurement.id === selectedMeasurementId) ??
      itemMeasurements.find((measurement) => measurePriceByMeasurementId.has(measurement.id)) ??
      itemMeasurements[0] ??
      null;

    if (!nextMeasurement) {
      setSelectedMeasurementId(null);
      setMaterialUnitPriceInput('');
      return;
    }

    if (nextMeasurement.id !== selectedMeasurementId) {
      setSelectedMeasurementId(nextMeasurement.id);
    }
  }, [directPriceByItemId, itemMeasurements, measurePriceByMeasurementId, selectedItem, selectedMeasurementId]);

  useEffect(() => {
    if (!selectedItem) return;

    if (!selectedMeasurement) {
      if (itemMeasurements.length === 0) {
        const directPrice = directPriceByItemId.get(selectedItem.id);
        setMaterialUnitPriceInput(directPrice != null ? String(directPrice) : '');
      }
      return;
    }

    const measurementPrice = measurePriceByMeasurementId.get(selectedMeasurement.id);
    setMaterialUnitPriceInput(measurementPrice != null ? String(measurementPrice) : '');
  }, [directPriceByItemId, itemMeasurements.length, measurePriceByMeasurementId, selectedItem, selectedMeasurement]);

  useEffect(() => {
    setSelectedItemId('');
    setSelectedMeasurementId(null);
    setMaterialSearch('');
    setMaterialQuantityInput('1');
    setMaterialUnitPriceInput('');
    setMaterialNotesInput('');
  }, [selectedStoreId]);

  const resetServiceInputs = () => {
    setSelectedServiceId('');
    setServiceSearch('');
    setServiceQuantityInput('1');
    setServiceUnitPriceInput('');
    setServiceNotesInput('');
  };

  const resetMaterialInputs = () => {
    setSelectedItemId('');
    setSelectedMeasurementId(null);
    setMaterialSearch('');
    setMaterialQuantityInput('1');
    setMaterialUnitPriceInput('');
    setMaterialNotesInput('');
  };

  const addDraftService = () => {
    const quantity = parsePositiveInput(serviceQuantityInput);
    if (!selectedService || quantity == null) {
      setMessage('Selecciona un servicio y una cantidad valida.');
      return;
    }

    const unitPrice = parseNonNegativeInput(serviceUnitPriceInput);
    if (unitPrice == null) {
      setMessage('Ingresa un precio valido para el servicio.');
      return;
    }

    setDraftServices((current) => [
      ...current,
      {
        id: createDraftId(),
        service_id: selectedService.id,
        label: selectedService.name,
        quantity,
        unit_price: unitPrice,
        notes: serviceNotesInput.trim() ? serviceNotesInput.trim() : null,
        total_price: Number((quantity * unitPrice).toFixed(2)),
      },
    ]);
    resetServiceInputs();
  };

  const addDraftMaterial = () => {
    const quantity = parsePositiveInput(materialQuantityInput);
    if (!selectedStore || !selectedItem || quantity == null) {
      setMessage('Selecciona una tienda, un material y una cantidad valida.');
      return;
    }

    if (hasMeasurements && !selectedMeasurement) {
      setMessage('Selecciona una medida para el material.');
      return;
    }

    const unitPrice = parseNonNegativeInput(materialUnitPriceInput);
    if (unitPrice == null) {
      setMessage('Ingresa un costo valido para el material.');
      return;
    }

    const label = selectedMeasurement ? formatMeasuredItemDisplayName(selectedItem, selectedMeasurement) : formatItemDisplayName(selectedItem);
    const unit = selectedMeasurement?.unit ?? selectedItem.unit ?? 'mt';

    setDraftMaterials((current) => [
      ...current,
      {
        id: createDraftId(),
        item_id: selectedItem.id,
        item_measurement_id: selectedMeasurement?.id ?? null,
        label,
        quantity,
        unit,
        unit_price: unitPrice,
        source_store_id: selectedStore.id,
        source_store_name: selectedStore.name,
        notes: materialNotesInput.trim() ? materialNotesInput.trim() : null,
        total_price: getMaterialEffectiveTotalPrice(quantity, unitPrice, null, null),
      },
    ]);
    resetMaterialInputs();
  };

  return (
    <AppScreen title="Nuevo trabajo">
      <LoadingOrError isLoading={catalogsLoading} error={catalogError} />

      {hasLinkedAppointment ? (
        <Card mode="contained" style={styles.infoCard}>
          <Card.Content style={styles.infoCardContent}>
            <Text style={styles.infoTitle}>Turno seleccionado</Text>
            <Text style={styles.infoText}>
              {formatDateAr(scheduledFor)}
              {startsAt ? ` - ${formatTimeShort(startsAt)}` : ''}
            </Text>
            <Text style={styles.infoHelper}>El turno se vincula al trabajo cuando guardas el formulario.</Text>
          </Card.Content>
        </Card>
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
                  <Card mode="outlined" style={styles.sectionCard}>
                    <Card.Content style={styles.sectionContent}>
                      <View style={styles.sectionHeader}>
                        <Text variant="titleMedium">Fecha</Text>
                        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                          Opcional. Si la completas, el trabajo tambien queda agendado.
                        </Text>
                      </View>

                      <TextInput
                        mode="outlined"
                        label="Fecha (DD-MM-AAAA)"
                        value={scheduleDate}
                        onChangeText={(value) => setScheduleDate(maskDateInput(value))}
                        placeholder="12-03-2026"
                        keyboardType="number-pad"
                        maxLength={10}
                        outlineStyle={styles.inputOutline}
                        disabled={busy}
                        right={<TextInput.Icon icon="calendar-month-outline" onPress={() => setCalendarVisible(true)} />}
                      />
                      <TextInput
                        mode="outlined"
                        label="Hora (opcional)"
                        value={scheduleTime}
                        onChangeText={(value) => setScheduleTime(maskTimeInput(value))}
                        placeholder="09:30"
                        keyboardType="number-pad"
                        maxLength={5}
                        outlineStyle={styles.inputOutline}
                        disabled={busy}
                      />
                      <View style={styles.actionsRow}>
                        <Button mode="text" compact onPress={() => setCalendarVisible(true)} disabled={busy}>
                          Elegir fecha
                        </Button>
                        <Button
                          mode="text"
                          compact
                          onPress={() => {
                            setScheduleDate('');
                            setScheduleTime('');
                          }}
                          disabled={busy || (!scheduleDate.trim() && !scheduleTime.trim())}
                        >
                          Limpiar
                        </Button>
                      </View>
                    </Card.Content>
                  </Card>
                ) : null}

                <Card mode="outlined" style={styles.sectionCard}>
                  <Card.Content style={styles.sectionContent}>
                    <View style={styles.sectionHeader}>
                      <Text variant="titleMedium">Servicios</Text>
                      <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                        Puedes agregar servicios antes de crear el trabajo.
                      </Text>
                    </View>

                    <QuoteItemsSummary
                      title={`Servicios del borrador (${serviceSummaryRows.length})`}
                      rows={serviceSummaryRows}
                      headerTint={theme.colors.softBlueStrong}
                      emptyText="No agregaste servicios todavia."
                      disabled={busy}
                      onDelete={(itemId) => setDraftServices((current) => current.filter((service) => service.id !== itemId))}
                    />

                    <Searchbar
                      placeholder="Buscar servicio"
                      value={serviceSearch}
                      onChangeText={setServiceSearch}
                      style={styles.searchbar}
                      inputStyle={styles.searchbarInput}
                    />

                    {selectedService ? (
                      <View style={[styles.selectedBanner, { backgroundColor: BRAND_BLUE_SOFT }]}>
                        <Text style={[styles.selectedBannerText, { color: BRAND_BLUE }]} numberOfLines={1}>
                          Servicio: {selectedService.name}
                        </Text>
                        <Button compact mode="text" onPress={() => setSelectedServiceId('')} disabled={busy}>
                          Quitar
                        </Button>
                      </View>
                    ) : null}

                    <View style={styles.resultsList}>
                      {filteredServices.length > 0 ? (
                        filteredServices.map((service) => {
                          const selected = service.id === selectedServiceId;
                          return (
                            <Pressable
                              key={service.id}
                              onPress={() => {
                                setSelectedServiceId(service.id);
                                setServiceUnitPriceInput(String(service.base_price));
                              }}
                              style={[styles.resultRow, selected && styles.serviceResultRowSelected]}
                            >
                              <View style={styles.resultInfo}>
                                <Text style={styles.resultTitle}>{service.name}</Text>
                                <Text style={styles.resultMeta}>{service.category ?? 'Sin categoria'}</Text>
                              </View>
                              <Text style={styles.resultPrice}>{formatCurrencyArs(service.base_price)}</Text>
                            </Pressable>
                          );
                        })
                      ) : (
                        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>No hay servicios que coincidan con la busqueda.</Text>
                      )}
                    </View>

                    <View style={styles.inlineFields}>
                      <TextInput
                        mode="outlined"
                        label="Cantidad"
                        value={serviceQuantityInput}
                        onChangeText={setServiceQuantityInput}
                        keyboardType="decimal-pad"
                        outlineStyle={styles.inputOutline}
                        style={styles.inlineField}
                        disabled={busy}
                      />
                      <TextInput
                        mode="outlined"
                        label="Precio unitario"
                        value={serviceUnitPriceInput}
                        onChangeText={setServiceUnitPriceInput}
                        keyboardType="decimal-pad"
                        outlineStyle={styles.inputOutline}
                        style={styles.inlineField}
                        disabled={busy}
                      />
                    </View>
                    <TextInput
                      mode="outlined"
                      label="Notas del servicio"
                      value={serviceNotesInput}
                      onChangeText={setServiceNotesInput}
                      outlineStyle={styles.inputOutline}
                      disabled={busy}
                    />
                    <View style={styles.previewRow}>
                      <Text style={[styles.previewLabel, { color: theme.colors.textMuted }]}>Total estimado</Text>
                      <Text style={styles.previewValue}>{formatCurrencyArs(servicePreviewTotal)}</Text>
                    </View>
                    <Button mode="outlined" onPress={addDraftService} disabled={busy}>
                      Agregar servicio
                    </Button>
                  </Card.Content>
                </Card>

                <Card mode="outlined" style={styles.sectionCard}>
                  <Card.Content style={styles.sectionContent}>
                    <View style={styles.sectionHeader}>
                      <Text variant="titleMedium">Materiales</Text>
                      <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                        Selecciona tienda y material para dejarlo listo desde esta pantalla.
                      </Text>
                    </View>

                    <QuoteItemsSummary
                      title={`Materiales del borrador (${materialSummaryRows.length})`}
                      rows={materialSummaryRows}
                      headerTint={theme.colors.softGreenStrong}
                      emptyText="No agregaste materiales todavia."
                      disabled={busy}
                      onDelete={(itemId) => setDraftMaterials((current) => current.filter((material) => material.id !== itemId))}
                    />

                    <Searchbar
                      placeholder="Buscar tienda"
                      value={storeSearch}
                      onChangeText={setStoreSearch}
                      style={styles.searchbar}
                      inputStyle={styles.searchbarInput}
                    />

                    {selectedStore ? (
                      <View style={[styles.selectedBanner, { backgroundColor: BRAND_BLUE_SOFT }]}>
                        <Text style={[styles.selectedBannerText, { color: BRAND_BLUE }]} numberOfLines={1}>
                          Tienda: {selectedStore.name}
                        </Text>
                        <Button compact mode="text" onPress={() => setSelectedStoreId(null)} disabled={busy}>
                          Quitar
                        </Button>
                      </View>
                    ) : null}

                    <View style={styles.storeGrid}>
                      {filteredStores.length > 0 ? (
                        filteredStores.map((store) => {
                          const selected = store.id === selectedStoreId;
                          return (
                            <Pressable
                              key={store.id}
                              onPress={() => setSelectedStoreId(store.id)}
                              style={[styles.storeGridCell, selected && styles.storeGridCellSelected]}
                            >
                              <Text style={selected ? styles.storeGridCellNameSelected : styles.storeGridCellName} numberOfLines={1}>
                                {store.name}
                              </Text>
                              {store.address ? (
                                <Text style={styles.storeGridCellMeta} numberOfLines={1}>
                                  {store.address}
                                </Text>
                              ) : null}
                            </Pressable>
                          );
                        })
                      ) : (
                        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>No hay tiendas para mostrar.</Text>
                      )}
                    </View>

                    <Searchbar
                      placeholder={selectedStoreId ? 'Buscar material' : 'Selecciona una tienda primero'}
                      value={materialSearch}
                      onChangeText={setMaterialSearch}
                      style={styles.searchbar}
                      inputStyle={styles.searchbarInput}
                      editable={Boolean(selectedStoreId)}
                    />

                    {selectedItem ? (
                      <View style={[styles.selectedBanner, { backgroundColor: BRAND_GREEN_SOFT }]}>
                        <Text style={[styles.selectedBannerText, { color: BRAND_GREEN }]} numberOfLines={1}>
                          Material: {selectedMeasurement ? formatMeasuredItemDisplayName(selectedItem, selectedMeasurement) : formatItemDisplayName(selectedItem)}
                        </Text>
                        <Button
                          compact
                          mode="text"
                          onPress={() => {
                            setSelectedItemId('');
                            setSelectedMeasurementId(null);
                          }}
                          disabled={busy}
                        >
                          Quitar
                        </Button>
                      </View>
                    ) : null}

                    <View style={styles.resultsList}>
                      {selectedStoreId ? (
                        filteredItems.length > 0 ? (
                          filteredItems.map((item) => {
                            const selected = item.id === selectedItemId;
                            const directPrice = directPriceByItemId.get(item.id);
                            return (
                              <Pressable
                                key={item.id}
                                onPress={() => setSelectedItemId(item.id)}
                                style={[styles.resultRow, selected && styles.materialResultRowSelected]}
                              >
                                <View style={styles.resultInfo}>
                                  <Text style={styles.resultTitle}>{item.name}</Text>
                                  <Text style={styles.resultMeta}>
                                    {[item.category ?? 'Sin categoria', measuredItemIds.has(item.id) ? 'Con medidas' : 'Precio directo'].join(' - ')}
                                  </Text>
                                </View>
                                <Text style={styles.resultPrice}>{directPrice != null ? formatCurrencyArs(directPrice) : 'Ver medidas'}</Text>
                              </Pressable>
                            );
                          })
                        ) : (
                          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>No hay materiales con precio cargado en esa tienda.</Text>
                        )
                      ) : (
                        <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>Primero selecciona una tienda para ver materiales.</Text>
                      )}
                    </View>

                    {selectedItem && hasMeasurements ? (
                      <View style={styles.measurementsList}>
                        {itemMeasurements.map((measurement) => {
                          const selected = measurement.id === selectedMeasurementId;
                          const measurementPrice = measurePriceByMeasurementId.get(measurement.id);
                          return (
                            <Pressable
                              key={measurement.id}
                              onPress={() => setSelectedMeasurementId(measurement.id)}
                              style={[styles.measurementRow, selected && styles.materialResultRowSelected]}
                            >
                              <View style={styles.resultInfo}>
                                <Text style={styles.resultTitle}>{formatMeasurementDisplayLabel(measurement) ?? measurement.label}</Text>
                                <Text style={styles.resultMeta}>
                                  {measurement.pricing_mode === 'calculated'
                                    ? `${measurement.grams_per_meter ?? 0} gr/mt`
                                    : 'Carga manual por mt'}
                                </Text>
                              </View>
                              <Text style={styles.resultPrice}>
                                {measurementPrice != null ? `${formatCurrencyArs(measurementPrice)} / mt` : 'Sin precio'}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}

                    <View style={styles.inlineFields}>
                      <TextInput
                        mode="outlined"
                        label="Cantidad"
                        value={materialQuantityInput}
                        onChangeText={setMaterialQuantityInput}
                        keyboardType="decimal-pad"
                        outlineStyle={styles.inputOutline}
                        style={styles.inlineField}
                        disabled={busy}
                      />
                      <TextInput
                        mode="outlined"
                        label="Costo"
                        value={materialUnitPriceInput}
                        onChangeText={setMaterialUnitPriceInput}
                        keyboardType="decimal-pad"
                        outlineStyle={styles.inputOutline}
                        style={styles.inlineField}
                        disabled={busy}
                      />
                    </View>
                    <TextInput
                      mode="outlined"
                      label="Notas del material"
                      value={materialNotesInput}
                      onChangeText={setMaterialNotesInput}
                      outlineStyle={styles.inputOutline}
                      disabled={busy}
                    />
                    <View style={styles.previewRow}>
                      <Text style={[styles.previewLabel, { color: theme.colors.textMuted }]}>Total estimado</Text>
                      <Text style={styles.previewValue}>{formatCurrencyArs(materialPreviewTotal)}</Text>
                    </View>
                    <Button mode="outlined" onPress={addDraftMaterial} disabled={busy}>
                      Agregar material
                    </Button>
                  </Card.Content>
                </Card>
              </View>
            }
            onSubmit={async (values) => {
              let quoteId: string | null = null;
              try {
                setIsSavingWorkflow(true);

                if (!hasLinkedAppointment && scheduleTime.trim() && !scheduleDate.trim()) {
                  throw new Error('Ingresa una fecha antes de cargar una hora.');
                }

                const normalizedDate = !hasLinkedAppointment && scheduleDate.trim() ? normalizeDateInput(scheduleDate) : null;
                const normalizedTime = !hasLinkedAppointment ? normalizeOptionalTimeInput(scheduleTime) : null;

                const quote = await upsertQuote({
                  title: values.title,
                  client_name: values.client_name,
                  client_phone: values.client_phone?.trim() ? values.client_phone.trim() : null,
                  notes: values.notes?.trim() ? values.notes.trim() : null,
                  status: 'pending',
                });
                quoteId = quote.id;

                for (const service of draftServices) {
                  await addQuoteServiceItem({
                    quote_id: quote.id,
                    service_id: service.service_id,
                    quantity: service.quantity,
                    unit_price: service.unit_price,
                    margin_percent: null,
                    notes: service.notes,
                  });
                }

                for (const material of draftMaterials) {
                  await addQuoteMaterialItem({
                    quote_id: quote.id,
                    item_id: material.item_id,
                    item_measurement_id: material.item_measurement_id,
                    quantity: material.quantity,
                    unit: material.unit,
                    unit_price: material.unit_price,
                    margin_percent: null,
                    source_store_id: material.source_store_id,
                    notes: material.notes,
                  });
                }

                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['quotes'] }),
                  queryClient.invalidateQueries({ queryKey: ['quote-detail', quote.id] }),
                ]);

                if (hasLinkedAppointment) {
                  try {
                    await linkAppointment.mutateAsync({
                      appointmentId,
                      quoteId: quote.id,
                      title: values.title.trim(),
                      notes: values.notes?.trim() ? values.notes.trim() : null,
                    });
                    toast.success('Trabajo creado y vinculado.');
                    router.replace(`/quotes/${quote.id}`);
                    return;
                  } catch {
                    router.replace({
                      pathname: '/quotes/[id]',
                      params: {
                        id: quote.id,
                        warning: 'link-appointment',
                      },
                    });
                    return;
                  }
                }

                if (normalizedDate) {
                  try {
                    await scheduleQuote.mutateAsync({
                      quote_id: quote.id,
                      title: `${values.client_name.trim()} - ${values.title.trim()}`,
                      notes: values.notes?.trim() ? values.notes.trim() : null,
                      scheduled_for: normalizedDate,
                      starts_at: normalizedTime,
                      ends_at: null,
                      status: 'scheduled',
                      store_id: null,
                    });
                    toast.success(`Trabajo creado y programado para ${formatDateAr(normalizedDate)}${normalizedTime ? ` - ${formatTimeShort(normalizedTime)}` : ''}.`);
                    router.replace(`/quotes/${quote.id}`);
                    return;
                  } catch {
                    router.replace({
                      pathname: '/quotes/[id]',
                      params: {
                        id: quote.id,
                        warning: 'schedule-appointment',
                      },
                    });
                    return;
                  }
                }

                toast.success('Trabajo creado.');
                router.replace(`/quotes/${quote.id}`);
              } catch (error) {
                if (quoteId) {
                  await deleteQuoteById(quoteId).catch(() => {});
                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['quotes'] }),
                    queryClient.invalidateQueries({ queryKey: ['appointments'] }),
                  ]).catch(() => {});
                  const cleanupMessage = error instanceof Error ? error.message : 'No se pudo guardar el trabajo.';
                  setMessage(`${cleanupMessage} Se elimino el borrador parcial del trabajo.`);
                  return;
                }

                setMessage(toUserErrorMessage(error, 'No se pudo guardar el trabajo.'));
              } finally {
                setIsSavingWorkflow(false);
              }
            }}
          />
        </Card.Content>
      </Card>

      <CalendarPickerDialog visible={calendarVisible} value={scheduleDate} onDismiss={() => setCalendarVisible(false)} onSelect={setScheduleDate} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  infoCardContent: {
    gap: 4,
    paddingVertical: 10,
  },
  infoTitle: {
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: '#5F6A76',
  },
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
  sectionCard: {
    borderRadius: 12,
  },
  sectionContent: {
    gap: 12,
    paddingVertical: 10,
  },
  sectionHeader: {
    gap: 4,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  inputOutline: {
    borderRadius: 10,
  },
  searchbar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D7E1ED',
  },
  searchbarInput: {
    paddingLeft: 4,
  },
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 4,
    gap: 8,
  },
  selectedBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  resultsList: {
    gap: 8,
  },
  resultRow: {
    borderWidth: 1,
    borderColor: '#D9E3EE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  serviceResultRowSelected: {
    borderColor: BRAND_BLUE,
    backgroundColor: BRAND_BLUE_SOFT,
  },
  materialResultRowSelected: {
    borderColor: BRAND_GREEN,
    backgroundColor: BRAND_GREEN_SOFT,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  resultMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: '#5F6A76',
  },
  resultPrice: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  previewLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  storeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  storeGridCell: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#D9E3EE',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  storeGridCellSelected: {
    borderColor: BRAND_BLUE,
    backgroundColor: BRAND_BLUE_SOFT,
  },
  storeGridCellName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  storeGridCellNameSelected: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: BRAND_BLUE,
  },
  storeGridCellMeta: {
    fontSize: 11,
    lineHeight: 15,
    color: '#5F6A76',
  },
  measurementsList: {
    gap: 8,
  },
  measurementRow: {
    borderWidth: 1,
    borderColor: '#D9E3EE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
});
