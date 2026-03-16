import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Menu, Searchbar, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItemMeasurements, useItems, useSaveItem } from '@/features/items/hooks';
import { useLatestMeasurePrices, useLatestPrices } from '@/features/prices/hooks';
import { useAddQuoteMaterialItem, useQuoteDetail } from '@/features/quotes/hooks';
import { getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from '@/features/quotes/materialPricing';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs } from '@/lib/format';
import { formatMeasurementDisplayLabel, formatMeasuredItemDisplayName } from '@/lib/itemDisplay';
import { BRAND_BLUE, BRAND_BLUE_SOFT, BRAND_GREEN, BRAND_GREEN_SOFT } from '@/theme';

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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const quoteDetail = useQuoteDetail(id ?? '');
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const latestPricesQuery = useLatestPrices();
  const add = useAddQuoteMaterialItem();
  const saveItem = useSaveItem();

  const [entryMode, setEntryMode] = useState<MaterialEntryMode>('catalog');
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [quantityInput, setQuantityInput] = useState('1');
  const [unitPriceInput, setUnitPriceInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));

  const { data: measurements, isLoading: measurementsLoading, error: measurementsError } = useItemMeasurements(selectedItemId);
  const latestMeasurePricesQuery = useLatestMeasurePrices(selectedStoreId ? { storeId: selectedStoreId } : {});

  const materialItems = useMemo(() => (items ?? []).filter((item) => item.item_type === 'material'), [items]);
  const availableStores = useMemo(() => (stores ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [stores]);
  const selectedStore = availableStores.find((store) => store.id === selectedStoreId) ?? null;
  const selectedItem = materialItems.find((item) => item.id === selectedItemId) ?? null;
  const itemMeasurements = measurements ?? [];
  const selectedMeasurement = itemMeasurements.find((measurement) => measurement.id === selectedMeasurementId) ?? null;
  const hasMeasurements = itemMeasurements.length > 0;

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
  const effectiveUnitPrice = getMaterialEffectiveUnitPrice(parsedUnitPrice, null, defaultMarginPercent);
  const effectiveTotal = getMaterialEffectiveTotalPrice(parsedQuantity, parsedUnitPrice, null, defaultMarginPercent);

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
        margin_percent: null,
        source_store_id: sourceStoreId,
        notes: notesInput.trim() || null,
      });

      toast.success('Material agregado.');
      router.back();
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

                <Menu
                  visible={storeMenuVisible}
                  onDismiss={() => setStoreMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      icon="storefront-outline"
                      onPress={() => setStoreMenuVisible(true)}
                      style={styles.selectButton}
                      contentStyle={styles.selectButtonContent}
                    >
                      {selectedStore?.name ?? 'Seleccionar tienda'}
                    </Button>
                  }
                >
                  {availableStores.map((store) => (
                    <Menu.Item
                      key={store.id}
                      title={store.name}
                      onPress={() => {
                        setSelectedStoreId(store.id);
                        setStoreMenuVisible(false);
                      }}
                    />
                  ))}
                </Menu>

                {availableStores.length > 6 ? (
                  <Searchbar placeholder="Buscar tienda" value={storeSearch} onChangeText={setStoreSearch} style={styles.searchbar} />
                ) : null}

                {!selectedStoreId && filteredStores.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storeChipsRow}>
                    {filteredStores.map((store) => {
                      const selected = store.id === selectedStoreId;
                      return (
                        <Pressable
                          key={store.id}
                          onPress={() => setSelectedStoreId(store.id)}
                          style={[styles.storeChip, selected ? styles.storeChipSelected : null]}
                        >
                          <Text style={selected ? styles.storeChipSelectedText : styles.storeChipText}>{store.name}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                ) : null}
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

              <TextInput mode="outlined" label="Nombre" value={manualName} onChangeText={setManualName} outlineStyle={styles.inputOutline} />
              <TextInput mode="outlined" label="Categoria" value={manualCategory} onChangeText={setManualCategory} outlineStyle={styles.inputOutline} />
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
              />
              <TextInput
                mode="outlined"
                label="Costo"
                value={unitPriceInput}
                onChangeText={setUnitPriceInput}
                keyboardType="decimal-pad"
                outlineStyle={styles.inputOutline}
                style={styles.inlineField}
              />
            </View>

            <TextInput
              mode="outlined"
              label="Notas"
              value={notesInput}
              onChangeText={setNotesInput}
              outlineStyle={styles.inputOutline}
              multiline
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
          </Card.Content>
        </Card>
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
  selectButton: {
    borderRadius: 10,
    borderColor: '#D7E1ED',
  },
  selectButtonContent: {
    minHeight: 44,
  },
  searchbar: {
    borderRadius: 12,
  },
  storeChipsRow: {
    gap: 8,
  },
  storeChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BRAND_BLUE_SOFT,
  },
  storeChipSelected: {
    backgroundColor: BRAND_BLUE,
  },
  storeChipText: {
    color: BRAND_BLUE,
    fontWeight: '600',
  },
  storeChipSelectedText: {
    color: '#FFFFFF',
    fontWeight: '600',
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
    borderColor: BRAND_BLUE,
    backgroundColor: BRAND_BLUE_SOFT,
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
    color: BRAND_BLUE,
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
});
