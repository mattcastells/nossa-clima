import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Menu, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItemMeasurements, useItems } from '@/features/items/hooks';
import { useCreateMeasurePrice, useCreatePrice, useLatestManualMeasurePrices, useLatestMeasurePrices, useLatestPrices } from '@/features/prices/hooks';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';
import { useAppTheme } from '@/theme';
import type { LatestStoreItemMeasurementPrice, LatestStoreItemPrice } from '@/types/db';

const getSingleParam = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] ?? '' : value ?? '');

const parsePriceInput = (value: string): number | null => {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = Number(normalized.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const formatStoreSummary = (
  measureRows: LatestStoreItemMeasurementPrice[],
  baseRow: LatestStoreItemPrice | null,
  hasCalculatedMeasures: boolean,
  basePriceLabel: string | null,
): { primary: string; secondary?: string } => {
  if (measureRows.length === 0 && !baseRow) {
    return { primary: 'Sin precios cargados' };
  }

  if (measureRows.length > 0) {
    const latestMeasureRow = measureRows[0] ?? null;
    const summary: { primary: string; secondary?: string } = {
      primary: `${measureRows.length} medida${measureRows.length === 1 ? '' : 's'} con precio`,
    };

    if (hasCalculatedMeasures && baseRow) {
      summary.secondary = `${basePriceLabel?.trim() ? `${basePriceLabel.trim()}: ` : 'Base: '}${formatCurrencyArs(baseRow.price)} / kg`;
    } else if (latestMeasureRow) {
      summary.secondary = `Ultimo registro: ${formatDateAr(latestMeasureRow.observed_at)}`;
    }

    return summary;
  }

  const summary: { primary: string; secondary?: string } = {
    primary: `${basePriceLabel?.trim() ? `${basePriceLabel.trim()}: ` : 'Base: '}${formatCurrencyArs(baseRow?.price ?? 0)} / kg`,
  };

  if (baseRow) {
    summary.secondary = `Ultimo registro: ${formatDateAr(baseRow.observed_at)}`;
  }

  return summary;
};

export default function NewPricePage() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ itemId?: string | string[]; storeId?: string | string[] }>();
  const initialStoreId = getSingleParam(params.storeId).trim();
  const initialItemId = getSingleParam(params.itemId).trim();

  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: measurements, isLoading: measurementsLoading, error: measurementsError } = useItemMeasurements(initialItemId);
  const { data: latestBasePrices, isLoading: basePricesLoading, error: basePricesError } = useLatestPrices();
  const { data: latestEffectiveMeasurePrices, isLoading: effectivePricesLoading, error: effectivePricesError } = useLatestMeasurePrices({ itemId: initialItemId });
  const { data: latestManualMeasurePrices, isLoading: manualPricesLoading, error: manualPricesError } = useLatestManualMeasurePrices({
    itemId: initialItemId,
  });
  const createPrice = useCreatePrice();
  const createMeasurePrice = useCreateMeasurePrice();

  const [message, setMessage] = useState<string | null>(null);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState(initialStoreId);
  const [directPriceInput, setDirectPriceInput] = useState('');
  const [basePriceInput, setBasePriceInput] = useState('');
  const [manualPriceInputs, setManualPriceInputs] = useState<Record<string, string>>({});
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));

  const availableStores = useMemo(() => (stores ?? []).sort((a, b) => a.name.localeCompare(b.name)), [stores]);
  const availableMaterials = useMemo(() => (items ?? []).filter((item) => item.item_type === 'material'), [items]);
  const selectedItem = availableMaterials.find((item) => item.id === initialItemId) ?? null;
  const itemMeasurements = measurements ?? [];
  const hasMeasurements = itemMeasurements.length > 0;
  const calculatedMeasurements = itemMeasurements.filter((measurement) => measurement.pricing_mode === 'calculated');
  const manualMeasurements = itemMeasurements.filter((measurement) => measurement.pricing_mode === 'manual');
  const hasCalculatedMeasures = calculatedMeasurements.length > 0;
  const selectedStore = availableStores.find((store) => store.id === selectedStoreId) ?? null;

  const latestBasePriceByStoreId = useMemo(() => {
    const map = new Map<string, LatestStoreItemPrice>();
    (latestBasePrices ?? [])
      .filter((row) => row.item_id === initialItemId)
      .forEach((row) => {
        map.set(row.store_id, row);
      });
    return map;
  }, [initialItemId, latestBasePrices]);

  const latestMeasureRowsByStoreId = useMemo(() => {
    const map = new Map<string, LatestStoreItemMeasurementPrice[]>();
    (latestEffectiveMeasurePrices ?? []).forEach((row) => {
      const existing = map.get(row.store_id) ?? [];
      existing.push(row);
      map.set(row.store_id, existing);
    });
    map.forEach((rows, storeId) => {
      map.set(
        storeId,
        rows.slice().sort((a, b) => a.item_measurement_label.localeCompare(b.item_measurement_label)),
      );
    });
    return map;
  }, [latestEffectiveMeasurePrices]);

  const latestManualPriceByMeasurementId = useMemo(() => {
    const map = new Map<string, LatestStoreItemMeasurementPrice>();
    (latestManualMeasurePrices ?? [])
      .filter((row) => !selectedStoreId || row.store_id === selectedStoreId)
      .forEach((row) => {
        map.set(row.item_measurement_id, row);
      });
    return map;
  }, [latestManualMeasurePrices, selectedStoreId]);

  const selectedStoreBaseRow = selectedStoreId ? latestBasePriceByStoreId.get(selectedStoreId) ?? null : null;
  const selectedStoreMeasureRows = selectedStoreId ? latestMeasureRowsByStoreId.get(selectedStoreId) ?? [] : [];

  useEffect(() => {
    setDirectPriceInput(selectedStoreBaseRow && !hasMeasurements ? String(selectedStoreBaseRow.price) : '');
    setBasePriceInput(selectedStoreBaseRow && hasCalculatedMeasures ? String(selectedStoreBaseRow.price) : '');

    const nextManualInputs: Record<string, string> = {};
    manualMeasurements.forEach((measurement) => {
      const latestRow = latestManualPriceByMeasurementId.get(measurement.id);
      nextManualInputs[measurement.id] = latestRow ? String(latestRow.price) : '';
    });
    setManualPriceInputs(nextManualInputs);
  }, [hasCalculatedMeasures, hasMeasurements, latestManualPriceByMeasurementId, manualMeasurements, selectedStoreBaseRow]);

  const combinedError =
    storesError ??
    itemsError ??
    measurementsError ??
    basePricesError ??
    effectivePricesError ??
    manualPricesError;

  const savePrices = async () => {
    if (!selectedItem) return;
    if (!selectedStoreId) {
      setMessage('Selecciona una tienda.');
      return;
    }

    try {
      if (!hasMeasurements) {
        const parsedPrice = parsePriceInput(directPriceInput);
        if (parsedPrice == null || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
          throw new Error('Ingresa un precio valido mayor a 0.');
        }

        await createPrice.mutateAsync({
          store_id: selectedStoreId,
          item_id: selectedItem.id,
          price: parsedPrice,
          currency: 'ARS',
          observed_at: new Date().toISOString(),
          source_type: 'manual_update',
          quantity_reference: null,
          notes: null,
        });

        toast.success('Precio actualizado.');
        router.back();
        return;
      }

      const operations: Array<Promise<unknown>> = [];

      if (hasCalculatedMeasures) {
        const parsedBasePrice = parsePriceInput(basePriceInput);
        if (parsedBasePrice == null || !Number.isFinite(parsedBasePrice) || parsedBasePrice <= 0) {
          throw new Error('Ingresa el costo base por kg para las medidas calculadas.');
        }

        operations.push(
          createPrice.mutateAsync({
            store_id: selectedStoreId,
            item_id: selectedItem.id,
            price: parsedBasePrice,
            currency: 'ARS',
            observed_at: new Date().toISOString(),
            source_type: 'manual_update',
            quantity_reference: null,
            notes: `Base de calculo por kg para ${selectedItem.base_price_label?.trim() || selectedItem.name}`,
          }),
        );
      }

      manualMeasurements.forEach((measurement) => {
        const rawInput = manualPriceInputs[measurement.id] ?? '';
        if (!rawInput.trim()) return;

        const parsedPrice = parsePriceInput(rawInput);
        if (parsedPrice == null || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
          throw new Error(`El precio de ${measurement.label} debe ser mayor a 0.`);
        }

        operations.push(
          createMeasurePrice.mutateAsync({
            store_id: selectedStoreId,
            item_measurement_id: measurement.id,
            price: parsedPrice,
            currency: 'ARS',
            observed_at: new Date().toISOString(),
            source_type: 'manual_update',
            notes: null,
          }),
        );
      });

      if (operations.length === 0) {
        throw new Error('No hay precios para guardar.');
      }

      await Promise.all(operations);
      toast.success('Precios actualizados.');
      router.back();
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudieron guardar los precios.'));
    }
  };

  const busy = createPrice.isPending || createMeasurePrice.isPending;

  return (
    <AppScreen title="Registrar precio" showHomeButton={false}>
      <LoadingOrError
        isLoading={storesLoading || itemsLoading || measurementsLoading || basePricesLoading || effectivePricesLoading || manualPricesLoading}
        error={combinedError ? new Error(combinedError.message) : null}
      />

      {!storesLoading && !itemsLoading && !selectedItem ? (
        <Card mode="outlined" style={[styles.formCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
          <Card.Content style={styles.emptySelectionContent}>
            <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>Material no seleccionado</Text>
            <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
              Para registrar precios, primero entra al material que queres actualizar.
            </Text>
            <Link href="/items" asChild>
              <Button mode="contained">Ir a Materiales</Button>
            </Link>
          </Card.Content>
        </Card>
      ) : selectedItem ? (
        <>
          <Card mode="outlined" style={[styles.formCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
            <Card.Content style={styles.formContent}>
              <View style={styles.fieldGroup}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>Material</Text>
                <View style={[styles.readonlyField, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.readonlyValue, { color: theme.colors.onSurface }]}>{selectedItem.name}</Text>
                  {selectedItem.category ? <Text style={[styles.readonlyMeta, { color: theme.colors.textMuted }]}>{selectedItem.category}</Text> : null}
                  {hasMeasurements ? (
                    <Text style={[styles.readonlyMeta, { color: theme.colors.textMuted }]}>
                      {itemMeasurements.length} medida{itemMeasurements.length === 1 ? '' : 's'} configurada{itemMeasurements.length === 1 ? '' : 's'}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>Local</Text>
                <Menu
                  visible={storeMenuVisible}
                  onDismiss={() => setStoreMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      icon="chevron-down"
                      style={[styles.selectButton, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}
                      contentStyle={styles.selectButtonContent}
                      textColor={selectedStore ? theme.colors.onSurface : theme.colors.textMuted}
                      onPress={() => setStoreMenuVisible(true)}
                    >
                      {selectedStore?.name ?? 'Seleccionar o crear local'}
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
                  <Menu.Item
                    title="Crear local nuevo"
                    onPress={() => {
                      setStoreMenuVisible(false);
                      router.push({
                        pathname: '/stores/new',
                        params: {
                          returnTo: '/prices/new',
                          itemId: initialItemId,
                        },
                      });
                    }}
                  />
                </Menu>
              </View>

              {!hasMeasurements ? (
                <View style={styles.priceEditorBlock}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>Precio directo</Text>
                  <TextInput
                    mode="outlined"
                    label="Precio"
                    placeholder="Ej: 120000"
                    keyboardType="decimal-pad"
                    value={directPriceInput}
                    onChangeText={setDirectPriceInput}
                    outlineStyle={styles.inputOutline}
                  />
                </View>
              ) : (
                <>
                  {hasCalculatedMeasures ? (
                    <View style={styles.priceEditorBlock}>
                      <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>Base de calculo</Text>
                      <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                        Este valor se guarda por tienda en {selectedItem.base_price_label?.trim() || 'base'} (kg) y actualiza las medidas calculadas.
                      </Text>
                      <TextInput
                        mode="outlined"
                        label={`${selectedItem.base_price_label?.trim() || 'Precio base'} / kg`}
                        placeholder="Ej: 38000"
                        keyboardType="decimal-pad"
                        value={basePriceInput}
                        onChangeText={setBasePriceInput}
                        outlineStyle={styles.inputOutline}
                      />
                    </View>
                  ) : null}

                  <View style={styles.priceEditorBlock}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>Medidas</Text>
                    {itemMeasurements.map((measurement) => {
                      const effectiveRow = selectedStoreMeasureRows.find((row) => row.item_measurement_id === measurement.id) ?? null;

                      return (
                        <View key={measurement.id} style={[styles.measurementEditorRow, { borderColor: theme.colors.borderSoft }]}>
                          <View style={styles.measurementEditorInfo}>
                            <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>{measurement.label}</Text>
                            <Text style={{ color: theme.colors.textMuted }}>
                              {measurement.pricing_mode === 'calculated'
                                ? `${measurement.grams_per_meter} gr/mt`
                                : 'Carga manual por metro'}
                            </Text>
                            {effectiveRow ? (
                              <Text style={{ color: theme.colors.textMuted }}>
                                Actual: {formatCurrencyArs(effectiveRow.price)} / mt
                              </Text>
                            ) : null}
                          </View>

                          {measurement.pricing_mode === 'manual' ? (
                            <TextInput
                              mode="outlined"
                              label="$ / mt"
                              keyboardType="decimal-pad"
                              value={manualPriceInputs[measurement.id] ?? ''}
                              onChangeText={(value) =>
                                setManualPriceInputs((current) => ({
                                  ...current,
                                  [measurement.id]: value,
                                }))
                              }
                              outlineStyle={styles.inputOutline}
                              style={styles.measurementPriceInput}
                            />
                          ) : (
                            <View style={[styles.calculatedPriceChip, { backgroundColor: theme.colors.softGreen }]}>
                              <Text style={{ color: theme.colors.titleOnSoft, fontWeight: '700' }}>
                                {effectiveRow ? `${formatCurrencyArs(effectiveRow.price)} / mt` : 'Completa la base'}
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

              <Button
                mode="contained"
                loading={busy}
                disabled={busy}
                onPress={savePrices}
                style={styles.saveButton}
                contentStyle={styles.saveButtonContent}
              >
                Guardar precios
              </Button>
            </Card.Content>
          </Card>

          <Card mode="outlined" style={[styles.tableCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
            <Card.Content style={styles.tableContent}>
              <View style={styles.tableHeaderBlock}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>Locales y estado</Text>
                <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>Toca un local para seleccionarlo.</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
                <View style={styles.tableFrame}>
                  <View style={[styles.tableHeader, { backgroundColor: theme.colors.softGreen }]}>
                    <Text style={[styles.headerCell, styles.storeColumn, { color: theme.colors.titleOnSoft }]}>Local</Text>
                    <Text style={[styles.headerCell, styles.statusColumn, { color: theme.colors.titleOnSoft }]}>Estado</Text>
                    <Text style={[styles.headerCell, styles.dateColumn, { color: theme.colors.titleOnSoft }]}>Fecha</Text>
                  </View>

                  {availableStores.map((store, index) => {
                    const selected = store.id === selectedStoreId;
                    const baseRow = latestBasePriceByStoreId.get(store.id) ?? null;
                    const measureRows = latestMeasureRowsByStoreId.get(store.id) ?? [];
                    const summary = formatStoreSummary(measureRows, baseRow, hasCalculatedMeasures, selectedItem.base_price_label);
                    const referenceDate = measureRows[0]?.observed_at ?? baseRow?.observed_at ?? null;

                    return (
                      <Pressable
                        key={store.id}
                        onPress={() => setSelectedStoreId(store.id)}
                        style={({ pressed }) => [
                          styles.tableRow,
                          { borderColor: theme.colors.borderSoft },
                          index % 2 === 0 ? { backgroundColor: theme.colors.surface } : { backgroundColor: theme.colors.surfaceSoft },
                          selected && { borderColor: theme.colors.softGreenStrong, backgroundColor: theme.colors.softGreen },
                          pressed && !selected && { backgroundColor: theme.colors.surfaceMuted },
                          pressed && selected && { backgroundColor: theme.colors.softGreenStrong },
                        ]}
                      >
                        <Text style={[styles.rowCell, styles.storeColumn, styles.storeNameCell, { color: theme.colors.onSurface }]}>{store.name}</Text>
                        <View style={styles.statusColumn}>
                          <Text style={[styles.rowCell, { color: theme.colors.onSurface }]}>{summary.primary}</Text>
                          {summary.secondary ? <Text style={[styles.rowMeta, { color: theme.colors.textMuted }]}>{summary.secondary}</Text> : null}
                        </View>
                        <Text style={[styles.rowCell, styles.dateColumn, { color: theme.colors.textMuted }]}>
                          {referenceDate ? formatDateAr(referenceDate) : '-'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </Card.Content>
          </Card>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderRadius: 12,
  },
  formContent: {
    gap: 12,
    paddingVertical: 8,
  },
  emptySelectionContent: {
    gap: 10,
    paddingVertical: 8,
  },
  fieldGroup: {
    gap: 6,
  },
  readonlyField: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  readonlyValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  readonlyMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  selectButton: {
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  selectButtonContent: {
    minHeight: 44,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  inputOutline: {
    borderRadius: 10,
  },
  priceEditorBlock: {
    gap: 10,
  },
  measurementEditorRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  measurementEditorInfo: {
    flex: 1,
    gap: 3,
  },
  measurementPriceInput: {
    width: 128,
  },
  calculatedPriceChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 128,
    alignItems: 'center',
  },
  saveButton: {
    borderRadius: 10,
    marginTop: 4,
  },
  saveButtonContent: {
    minHeight: 44,
  },
  tableCard: {
    borderRadius: 12,
  },
  tableContent: {
    gap: 10,
    paddingVertical: 8,
  },
  tableHeaderBlock: {
    gap: 2,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  tableScrollContent: {
    paddingBottom: 2,
  },
  tableFrame: {
    minWidth: 520,
    gap: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerCell: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderWidth: 1,
  },
  rowCell: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  storeColumn: {
    width: 160,
    paddingRight: 8,
  },
  statusColumn: {
    width: 240,
    paddingRight: 8,
    gap: 2,
  },
  dateColumn: {
    width: 90,
  },
  storeNameCell: {
    fontWeight: '500',
  },
});
