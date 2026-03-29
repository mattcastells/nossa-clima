import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView as RNScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, IconButton, Searchbar, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { AppDialog } from '@/components/AppDialog';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItemMeasurements, useItems, useSaveItem } from '@/features/items/hooks';
import { useLatestMeasurePrices, useLatestPrices } from '@/features/prices/hooks';
import { useAddQuoteMaterialItem, useQuoteDetail, useUpdateQuoteMaterialItem, useDeleteQuoteMaterialItem } from '@/features/quotes/hooks';
import { getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from '@/features/quotes/materialPricing';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs } from '@/lib/format';
import { formatMeasurementDisplayLabel, formatMeasuredItemDisplayName } from '@/lib/itemDisplay';
import { getSingleRouteParam } from '@/lib/routeParams';
import { QuoteItemsSummary, SummaryRow } from '@/features/quotes/components/QuoteItemsSummary';
import { BRAND_BLUE, BRAND_BLUE_SOFT, BRAND_GREEN, BRAND_GREEN_SOFT, useAppTheme } from '@/theme';

type MaterialEntryMode = 'catalog' | 'manual';

const parsePositiveInput = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseNonNegativeInput = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export default function AddMaterialToQuotePage() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = getSingleRouteParam(params.id).trim();
  const router = useRouter();
  const theme = useAppTheme();
  const quoteDetail = useQuoteDetail(id ?? '');
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const latestPricesQuery = useLatestPrices();
  const add = useAddQuoteMaterialItem();
  const saveItem = useSaveItem();

  const scrollRef = useRef<RNScrollView>(null);
  const [addedCount, setAddedCount] = useState(0);

  const updateMaterial = useUpdateQuoteMaterialItem();
  const deleteMaterial = useDeleteQuoteMaterialItem();
  const isQuoteCompleted = quoteDetail.data?.quote.status === 'completed';
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState('');
  const [editingUnitPrice, setEditingUnitPrice] = useState('');
  const [editingMargin, setEditingMargin] = useState('');
  const [editingNotes, setEditingNotes] = useState('');

  const [entryMode, setEntryMode] = useState<MaterialEntryMode>('catalog');
  const [storeSearch, setStoreSearch] = useState('');
  const [storePage, setStorePage] = useState(0);
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [unitPriceInput, setUnitPriceInput] = useState('');
  const [marginInput, setMarginInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));

  /** Reset form fields after a successful add — keeps store & entry mode. */
  const resetFormForNextAdd = useCallback(() => {
    setSelectedItemId('');
    setSelectedMeasurementId(null);
    setQuantityInput('1');
    setUnitPriceInput('');
    setMarginInput('');
    setNotesInput('');
    setMaterialSearch('');
    setManualName('');
    setManualCategory('');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const { data: measurements, isLoading: measurementsLoading, error: measurementsError } = useItemMeasurements(selectedItemId);
  const latestMeasurePricesQuery = useLatestMeasurePrices(selectedStoreId ? { storeId: selectedStoreId } : {});

  const materialItems = useMemo(() => (items ?? []).filter((item) => item.item_type === 'material'), [items]);
  const availableStores = useMemo(() => (stores ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [stores]);
  const selectedStore = availableStores.find((store) => store.id === selectedStoreId) ?? null;
  const selectedItem = materialItems.find((item) => item.id === selectedItemId) ?? null;
  const itemMeasurements = useMemo(() => measurements ?? [], [measurements]);
  const selectedMeasurement = itemMeasurements.find((measurement) => measurement.id === selectedMeasurementId) ?? null;
  const hasMeasurements = itemMeasurements.length > 0;

  const materialSummaryRows: SummaryRow[] = useMemo(
    () =>
      (quoteDetail.data?.materials ?? []).map((m) => ({
        id: m.id,
        label: m.item_name_snapshot,
        quantityLabel: `${m.quantity}${m.unit ? ` ${m.unit}` : ''}`,
        unitPrice: m.unit_price,
        totalPrice: m.total_price,
      })),
    [quoteDetail.data?.materials],
  );

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

  const filteredStores = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();
    if (!query) return availableStores;

    return availableStores.filter(
      (store) =>
        store.name.toLowerCase().includes(query) ||
        (store.description ?? '').toLowerCase().includes(query) ||
        (store.address ?? '').toLowerCase().includes(query),
    );
  }, [availableStores, storeSearch]);

  const STORES_PER_PAGE = 10;
  const totalStorePages = Math.max(1, Math.ceil(filteredStores.length / STORES_PER_PAGE));
  const paginatedStores = useMemo(
    () => filteredStores.slice(storePage * STORES_PER_PAGE, (storePage + 1) * STORES_PER_PAGE),
    [filteredStores, storePage],
  );

  useEffect(() => {
    setStorePage(0);
  }, [storeSearch]);

  const catalogItems = useMemo(() => {
    if (!selectedStoreId) return [];

    return materialItems.filter((item) => directItemIds.has(item.id) || measuredItemIds.has(item.id));
  }, [directItemIds, materialItems, measuredItemIds, selectedStoreId]);

  const filteredItems = useMemo(() => {
    const query = materialSearch.trim().toLowerCase();
    if (!query) return catalogItems;

    return catalogItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.category ?? '').toLowerCase().includes(query) ||
        (item.base_price_label ?? '').toLowerCase().includes(query),
    );
  }, [catalogItems, materialSearch]);

  const defaultMarginPercent = quoteDetail.data?.quote.default_material_margin_percent ?? null;
  const parsedQuantity = parsePositiveInput(quantityInput) ?? 0;
  const parsedUnitPrice = parseNonNegativeInput(unitPriceInput) ?? 0;
  const parsedMargin = parseNonNegativeInput(marginInput);
  const effectiveUnitPrice = getMaterialEffectiveUnitPrice(parsedUnitPrice, parsedMargin, defaultMarginPercent);
  const effectiveTotal = getMaterialEffectiveTotalPrice(parsedQuantity, parsedUnitPrice, parsedMargin, defaultMarginPercent);

  useEffect(() => {
    setSelectedItemId('');
    setSelectedMeasurementId(null);
    setUnitPriceInput('');
  }, [entryMode]);

  useEffect(() => {
    setSelectedItemId('');
    setSelectedMeasurementId(null);
    setUnitPriceInput('');
  }, [selectedStoreId]);

  useEffect(() => {
    if (!selectedItem) {
      setSelectedMeasurementId(null);
      return;
    }

    if (itemMeasurements.length === 0) {
      setSelectedMeasurementId(null);
      const directPrice = directPriceByItemId.get(selectedItem.id);
      setUnitPriceInput(directPrice != null ? String(directPrice) : '');
      return;
    }

    const nextMeasurement =
      itemMeasurements.find((measurement) => measurement.id === selectedMeasurementId) ??
      itemMeasurements.find((measurement) => measurePriceByMeasurementId.has(measurement.id)) ??
      itemMeasurements[0] ??
      null;

    if (!nextMeasurement) {
      setSelectedMeasurementId(null);
      setUnitPriceInput('');
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
        setUnitPriceInput(directPrice != null ? String(directPrice) : '');
      }
      return;
    }

    const measurePrice = measurePriceByMeasurementId.get(selectedMeasurement.id);
    setUnitPriceInput(measurePrice != null ? String(measurePrice) : '');
  }, [directPriceByItemId, itemMeasurements.length, measurePriceByMeasurementId, selectedItem, selectedMeasurement]);

  const combinedError =
    quoteDetail.error ??
    itemsError ??
    storesError ??
    latestPricesQuery.error ??
    latestMeasurePricesQuery.error ??
    measurementsError;

  const submit = async () => {
    try {
      const quantity = parsePositiveInput(quantityInput);
      if (quantity == null) {
        throw new Error('Ingresa una cantidad valida.');
      }

      const unitPrice = parseNonNegativeInput(unitPriceInput);
      if (unitPrice == null) {
        throw new Error('Ingresa un costo valido.');
      }

      let itemId = selectedItemId;
      let itemMeasurementId: string | null = selectedMeasurementId;
      let unit = selectedMeasurement?.unit ?? selectedItem?.unit ?? 'mt';
      let sourceStoreId: string | null = entryMode === 'catalog' ? selectedStoreId : null;

      if (entryMode === 'catalog') {
        if (!selectedStoreId) {
          throw new Error('Selecciona una tienda.');
        }

        if (!selectedItem) {
          throw new Error('Selecciona un material.');
        }

        if (hasMeasurements && !selectedMeasurement) {
          throw new Error('Selecciona una medida.');
        }
      } else {
        const normalizedName = manualName.trim();
        if (!normalizedName) {
          throw new Error('Ingresa el nombre del material manual.');
        }

        const createdItem = await saveItem.mutateAsync({
          name: normalizedName,
          item_type: 'material',
          category: manualCategory.trim() || null,
          unit: 'mt',
          brand: null,
          description: null,
          notes: null,
          base_price_label: null,
        });

        itemId = createdItem.id;
        itemMeasurementId = null;
        unit = createdItem.unit ?? 'mt';
        sourceStoreId = null;
      }

      await add.mutateAsync({
        quote_id: id ?? '',
        item_id: itemId,
        item_measurement_id: itemMeasurementId,
        quantity,
        unit,
        unit_price: unitPrice,
        margin_percent: parsedMargin ?? null,
        source_store_id: sourceStoreId,
        notes: notesInput.trim() || null,
      });

      setAddedCount((prev) => prev + 1);
      const count = addedCount + 1;
      toast.success(count > 1 ? `Material agregado (${count} en total).` : 'Material agregado.');
      resetFormForNextAdd();
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo agregar el material.'));
    }
  };

  const busy = add.isPending || saveItem.isPending;
  const loading =
    quoteDetail.isLoading ||
    itemsLoading ||
    storesLoading ||
    latestPricesQuery.isLoading ||
    (Boolean(selectedStoreId) && latestMeasurePricesQuery.isLoading) ||
    (Boolean(selectedItemId) && measurementsLoading);

  const selectedMaterialTitle =
    selectedItem && selectedMeasurement
      ? formatMeasuredItemDisplayName(selectedItem, selectedMeasurement)
      : (selectedItem?.name ?? (manualName.trim() || 'Material'));
  const measurementPriceMissing = entryMode === 'catalog' && hasMeasurements && selectedMeasurement && !unitPriceInput.trim();

  return (
    <AppScreen title="Agregar material al trabajo">
      <LoadingOrError isLoading={loading} error={combinedError ? new Error(combinedError.message) : null} />

      <View style={styles.page}>
        {quoteDetail.data ? (
          <View style={{ marginBottom: 8 }}>
            <QuoteItemsSummary
              title={`Materiales del trabajo (${materialSummaryRows.length})`}
              rows={materialSummaryRows}
              headerTint={theme.colors.softGreenStrong}
              emptyText="No hay materiales en el trabajo."
              disabled={isQuoteCompleted || updateMaterial.isPending || deleteMaterial.isPending}
              onEdit={(itemId) => {
                const m = quoteDetail.data?.materials.find((mat) => mat.id === itemId);
                if (!m) return;
                setEditingMaterialId(m.id);
                setEditingQuantity(String(m.quantity));
                setEditingUnitPrice(String(m.unit_price));
                setEditingMargin(m.margin_percent == null ? '' : String(m.margin_percent));
                setEditingNotes(m.notes ?? '');
              }}
              onDelete={async (itemId) => {
                if (isQuoteCompleted) return;
                try { await deleteMaterial.mutateAsync(itemId); } catch { /* noop */ }
              }}
            />
          </View>
        ) : null}
        <View style={styles.modeBlock}>
          <Text variant="titleMedium">Modo de carga</Text>
          <SegmentedButtons
            value={entryMode}
            onValueChange={(value) => setEntryMode(value as MaterialEntryMode)}
            buttons={[
              { value: 'catalog', label: 'Desde lista' },
              { value: 'manual', label: 'Manual' },
            ]}
          />
        </View>

        {entryMode === 'catalog' ? (
          <>
            <Card mode="outlined" style={styles.sectionCard}>
              <Card.Content style={styles.sectionContent}>
                <View style={styles.sectionHeader}>
                  <Text variant="titleSmall">Tienda</Text>
                  <Text style={styles.helperText}>Se usa para traer el precio actual del material o de cada medida.</Text>
                </View>

                <Searchbar placeholder="Buscar tienda" value={storeSearch} onChangeText={setStoreSearch} inputStyle={styles.searchbarInput} style={styles.searchbar} />

                {selectedStore ? (
                  <View style={styles.storeSelectedBanner}>
                    <Text style={styles.storeSelectedText}>✓ {selectedStore.name}</Text>
                    <IconButton icon="close" size={18} onPress={() => setSelectedStoreId(null)} style={styles.storeClearBtn} />
                  </View>
                ) : null}

                {filteredStores.length > 0 ? (
                  <>
                    <View style={styles.storeGrid}>
                      {paginatedStores.map((store) => {
                        const selected = store.id === selectedStoreId;
                        return (
                          <Pressable
                            key={store.id}
                            onPress={() => setSelectedStoreId(store.id)}
                            style={[styles.storeGridCell, selected ? styles.storeGridCellSelected : null]}
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
                      })}
                    </View>

                    {totalStorePages > 1 ? (
                      <View style={styles.storePagination}>
                        <Button
                          mode="text"
                          compact
                          disabled={storePage === 0}
                          onPress={() => setStorePage((p) => Math.max(0, p - 1))}
                          icon="chevron-left"
                        >
                          Anterior
                        </Button>
                        <Text style={styles.storePaginationLabel}>
                          {storePage + 1} / {totalStorePages}
                        </Text>
                        <Button
                          mode="text"
                          compact
                          disabled={storePage >= totalStorePages - 1}
                          onPress={() => setStorePage((p) => Math.min(totalStorePages - 1, p + 1))}
                          icon="chevron-right"
                          contentStyle={styles.storePaginationNextContent}
                        >
                          Siguiente
                        </Button>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.helperText}>No se encontraron tiendas.</Text>
                )}
              </Card.Content>
            </Card>

            <Card mode="outlined" style={styles.sectionCard}>
              <Card.Content style={styles.sectionContent}>
                <View style={styles.sectionHeader}>
                  <Text variant="titleSmall">Material</Text>
                  <Text style={styles.helperText}>
                    {selectedStoreId ? 'Se muestran solo materiales con precio disponible en la tienda.' : 'Primero selecciona una tienda.'}
                  </Text>
                </View>

                <Searchbar
                  placeholder={selectedStoreId ? 'Buscar material' : 'Selecciona una tienda para buscar'}
                  value={materialSearch}
                  onChangeText={setMaterialSearch}
                  editable={Boolean(selectedStoreId)}
                  inputStyle={styles.searchbarInput}
                  style={styles.searchbar}
                />

                {selectedStoreId ? (
                  filteredItems.length > 0 ? (
                    <View style={styles.resultsList}>
                      {filteredItems.map((item) => {
                        const selected = item.id === selectedItemId;
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => setSelectedItemId(item.id)}
                            style={[styles.resultRow, selected ? styles.resultRowSelected : null]}
                          >
                            <View style={styles.resultInfo}>
                              <Text style={styles.resultTitle}>{item.name}</Text>
                              <Text style={styles.resultMeta}>
                                {[item.category ?? 'Sin categoria', measuredItemIds.has(item.id) ? 'Con medidas' : 'Precio directo por mt'].join(' · ')}
                              </Text>
                            </View>
                            {!measuredItemIds.has(item.id) && directPriceByItemId.has(item.id) ? (
                              <Text style={styles.resultPrice}>{formatCurrencyArs(directPriceByItemId.get(item.id) ?? 0)}</Text>
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.helperText}>No hay materiales con precio para esa tienda.</Text>
                  )
                ) : null}
              </Card.Content>
            </Card>

            {selectedItem && hasMeasurements ? (
              <Card mode="outlined" style={styles.sectionCard}>
                <Card.Content style={styles.sectionContent}>
                  <View style={styles.sectionHeader}>
                    <Text variant="titleSmall">Medida</Text>
                    <Text style={styles.helperText}>Cada medida usa su precio final por metro.</Text>
                  </View>

                  <View style={styles.measurementsList}>
                    {itemMeasurements.map((measurement) => {
                      const selected = measurement.id === selectedMeasurementId;
                      const price = measurePriceByMeasurementId.get(measurement.id);

                      return (
                        <Pressable
                          key={measurement.id}
                          onPress={() => setSelectedMeasurementId(measurement.id)}
                          style={[styles.measurementRow, selected ? styles.measurementRowSelected : null]}
                        >
                          <View style={styles.measurementInfo}>
                            <Text style={styles.measurementTitle}>{formatMeasurementDisplayLabel(measurement) ?? measurement.label}</Text>
                            <Text style={styles.measurementMeta}>
                              {measurement.pricing_mode === 'calculated'
                                ? `${measurement.grams_per_meter ?? 0} gr/mt`
                                : 'Carga manual por mt'}
                            </Text>
                          </View>
                          <Text style={styles.measurementPrice}>{price != null ? `${formatCurrencyArs(price)} / mt` : 'Sin precio'}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Card.Content>
              </Card>
            ) : null}
          </>
        ) : (
          <Card mode="outlined" style={styles.sectionCard}>
            <Card.Content style={styles.sectionContent}>
              <View style={styles.sectionHeader}>
                <Text variant="titleSmall">Material manual</Text>
                <Text style={styles.helperText}>Para una carga rapida. Si el material necesita medidas, conviene crearlo desde Materiales.</Text>
              </View>

              <TextInput
                mode="outlined"
                label="Nombre"
                value={manualName}
                onChangeText={setManualName}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                scrollEnabled
              />
              <TextInput
                mode="outlined"
                label="Categoria"
                value={manualCategory}
                onChangeText={setManualCategory}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                scrollEnabled
              />
            </Card.Content>
          </Card>
        )}

        <Card mode="outlined" style={styles.sectionCard}>
          <Card.Content style={styles.sectionContent}>
            <View style={styles.sectionHeader}>
              <Text variant="titleSmall">Resumen</Text>
              <Text style={styles.helperText}>
                {defaultMarginPercent != null ? `El trabajo aplica un margen global de ${defaultMarginPercent}%.` : 'Sin margen global configurado.'}
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{selectedMaterialTitle}</Text>
              {entryMode === 'catalog' && selectedStore ? <Text style={styles.summaryMeta}>Origen: {selectedStore.name}</Text> : null}
              {measurementPriceMissing ? <Text style={styles.summaryWarning}>La medida seleccionada todavia no tiene precio cargado en esa tienda.</Text> : null}
            </View>

            <View style={styles.inlineFields}>
              <TextInput
                mode="outlined"
                label="Cantidad"
                value={quantityInput}
                onChangeText={setQuantityInput}
                keyboardType="decimal-pad"
                outlineStyle={styles.inputOutline}
                style={styles.inlineField}
                contentStyle={styles.inputContent}
                scrollEnabled
              />
              <TextInput
                mode="outlined"
                label="Costo"
                value={unitPriceInput}
                onChangeText={setUnitPriceInput}
                keyboardType="decimal-pad"
                outlineStyle={styles.inputOutline}
                style={styles.inlineField}
                contentStyle={styles.inputContent}
                scrollEnabled
              />
            </View>

            <TextInput
              mode="outlined"
              label="Margen % (opcional)"
              value={marginInput}
              onChangeText={setMarginInput}
              keyboardType="decimal-pad"
              outlineStyle={styles.inputOutline}
              placeholder={defaultMarginPercent != null ? `Global: ${defaultMarginPercent}%` : 'Sin margen'}
            />

            <TextInput
              mode="outlined"
              label="Notas"
              value={notesInput}
              onChangeText={setNotesInput}
              outlineStyle={styles.inputOutline}
              multiline
              contentStyle={styles.inputContentMultiline}
            />

            <View style={styles.previewBlock}>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Venta unitaria</Text>
                <Text style={styles.previewValue}>{formatCurrencyArs(effectiveUnitPrice)}</Text>
              </View>
              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Total</Text>
                <Text style={styles.previewValue}>{formatCurrencyArs(effectiveTotal)}</Text>
              </View>
            </View>

            <Button mode="contained" onPress={submit} loading={busy} disabled={busy}>
              Agregar material
            </Button>
            <Button mode="outlined" onPress={() => router.back()} disabled={busy} style={styles.backButton}>
              Volver al trabajo
            </Button>
          </Card.Content>
        </Card>
        <AppDialog visible={Boolean(editingMaterialId)} onDismiss={() => setEditingMaterialId(null)}>
          <Dialog.Title>Editar material</Dialog.Title>
          <Dialog.Content>
            <TextInput mode="outlined" label="Cantidad" value={editingQuantity} onChangeText={setEditingQuantity} keyboardType="decimal-pad" outlineStyle={styles.inputOutline} />
            <TextInput mode="outlined" label="Costo" value={editingUnitPrice} onChangeText={setEditingUnitPrice} keyboardType="decimal-pad" outlineStyle={styles.inputOutline} />
            <TextInput mode="outlined" label="Margen" value={editingMargin} onChangeText={setEditingMargin} keyboardType="decimal-pad" outlineStyle={styles.inputOutline} />
            <TextInput mode="outlined" label="Notas" value={editingNotes} onChangeText={setEditingNotes} outlineStyle={styles.inputOutline} multiline />
            <Button
              mode="contained"
              loading={updateMaterial.isPending}
              onPress={async () => {
                if (!editingMaterialId) return;
                const nextQuantity = parsePositiveInput(editingQuantity);
                if (nextQuantity == null) return;
                const nextUnitPrice = parseNonNegativeInput(editingUnitPrice);
                if (nextUnitPrice == null) return;
                const trimmedMargin = editingMargin.trim();
                const nextMargin = trimmedMargin ? Number(trimmedMargin.replace(',', '.')) : null;

                try {
                  await updateMaterial.mutateAsync({ itemId: editingMaterialId, payload: { quantity: nextQuantity, unit_price: nextUnitPrice, margin_percent: nextMargin, notes: editingNotes.trim() || null } });
                  setEditingMaterialId(null);
                } catch (err) {
                  // ignore - toast will show if needed
                }
              }}
            >
              Guardar cambios
            </Button>
          </Dialog.Content>
        </AppDialog>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 14,
  },
  modeBlock: {
    gap: 10,
  },
  sectionCard: {
    borderRadius: 14,
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
  storeSelectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BRAND_BLUE_SOFT,
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 2,
  },
  storeSelectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND_BLUE,
  },
  storeClearBtn: {
    margin: 0,
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
  storePagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storePaginationLabel: {
    fontSize: 13,
    color: '#5F6A76',
  },
  storePaginationNextContent: {
    flexDirection: 'row-reverse',
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
  resultRowSelected: {
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
    color: BRAND_GREEN,
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
  measurementRowSelected: {
    borderColor: BRAND_GREEN,
    backgroundColor: BRAND_GREEN_SOFT,
  },
  measurementInfo: {
    flex: 1,
    gap: 2,
  },
  measurementTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  measurementMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: '#5F6A76',
  },
  measurementPrice: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: BRAND_GREEN,
  },
  summaryCard: {
    gap: 4,
    borderWidth: 1,
    borderColor: '#D9E3EE',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  summaryTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  summaryMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: '#5F6A76',
  },
  summaryWarning: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9A3412',
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineField: {
    flex: 1,
  },
  previewBlock: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F7FAFD',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5F6A76',
  },
  previewValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  backButton: {
    borderRadius: 10,
    marginTop: 4,
  },
  inputContent: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  inputContentMultiline: {
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 80,
  },
});
