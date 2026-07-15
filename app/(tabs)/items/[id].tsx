import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { CatalogAuditCard } from '@/components/CatalogAuditCard';
import { useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { ItemForm } from '@/features/items/ItemForm';
import { getCategoryAccent } from '@/features/items/categoryAccent';
import { useItemMeasurements, useItems, useSaveItem, useSaveItemMeasurement } from '@/features/items/hooks';
import { useProfileDirectory } from '@/features/profiles/hooks';
import { useLatestMeasurePrices, useLatestPrices } from '@/features/prices/hooks';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatDateAr, formatDateTimeAr } from '@/lib/format';
import { getSingleRouteParam } from '@/lib/routeParams';
import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, FONT_SANS_SEMIBOLD, useAppTheme } from '@/theme';
import type { ItemMeasurement, LatestStoreItemMeasurementPrice, LatestStoreItemPrice } from '@/types/db';

const formatAuditActor = (userId: string | null | undefined, namesById: Map<string, string>): string => {
  if (!userId) return 'Usuario eliminado';
  return namesById.get(userId) ?? `Usuario ${userId.slice(0, 8)}`;
};

const parsePositiveNumberInput = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatStorePriceSummary = (
  effectiveRows: LatestStoreItemMeasurementPrice[],
  latestBaseRow: LatestStoreItemPrice | null,
  hasCalculatedMeasures: boolean,
  basePriceLabel: string | null,
): { primary: string; secondary?: string; tertiary?: string; hasPrice: boolean } => {
  if (effectiveRows.length === 0 && !latestBaseRow) {
    return {
      primary: 'Sin precio asignado',
      hasPrice: false,
    };
  }

  if (effectiveRows.length === 0 && latestBaseRow) {
    return {
      primary: `Base ${basePriceLabel?.trim() ? `${basePriceLabel.trim()} ` : ''}${
        latestBaseRow.price ? `cargada` : 'sin cargar'
      }`,
      secondary: `${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(latestBaseRow.price)} / kg`,
      tertiary: `Último registro: ${formatDateAr(latestBaseRow.observed_at)}`,
      hasPrice: true,
    };
  }

  const latestObservedAt = effectiveRows.reduce((current, row) => (row.observed_at > current ? row.observed_at : current), effectiveRows[0]?.observed_at ?? '');
  const manualCount = effectiveRows.filter((row) => row.price_origin === 'manual').length;
  const calculatedCount = effectiveRows.filter((row) => row.price_origin === 'calculated').length;

  const summary: { primary: string; secondary?: string; tertiary?: string; hasPrice: boolean } = {
    primary: `${effectiveRows.length} medida${effectiveRows.length === 1 ? '' : 's'} con precio por metro`,
    secondary:
      hasCalculatedMeasures && latestBaseRow
        ? `${basePriceLabel?.trim() ? `${basePriceLabel.trim()}: ` : 'Base: '}${
            new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(latestBaseRow.price)
          } / kg`
        : manualCount > 0 && calculatedCount > 0
          ? `${manualCount} manual${manualCount === 1 ? '' : 'es'} · ${calculatedCount} calculada${calculatedCount === 1 ? '' : 's'}`
          : manualCount > 0
            ? `${manualCount} manual${manualCount === 1 ? '' : 'es'}`
            : `${calculatedCount} calculada${calculatedCount === 1 ? '' : 's'}`,
    hasPrice: true,
  };

  if (latestObservedAt) {
    summary.tertiary = `Último registro: ${formatDateAr(latestObservedAt)}`;
  }

  return summary;
};

type DetailTab = 'data' | 'prices';

const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: 'data', label: 'Datos' },
  { key: 'prices', label: 'Medidas y precios' },
];

export default function ItemDetailPage() {
  const [activeTab, setActiveTab] = useState<DetailTab>('data');
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = getSingleRouteParam(params.id).trim();
  const router = useRouter();
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: measurements, isLoading: measurementsLoading, error: measurementsError } = useItemMeasurements(id ?? '');
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const { data: latestBasePrices, isLoading: basePricesLoading, error: basePricesError } = useLatestPrices();
  const { data: latestMeasurePrices, isLoading: measurePricesLoading, error: measurePricesError } = useLatestMeasurePrices({ itemId: id ?? '' });
  const save = useSaveItem();
  const saveMeasurement = useSaveItemMeasurement();
  const [message, setMessage] = useState<string | null>(null);
  const [measurementDialogVisible, setMeasurementDialogVisible] = useState(false);
  const [editingMeasurement, setEditingMeasurement] = useState<ItemMeasurement | null>(null);
  const [measurementLabel, setMeasurementLabel] = useState('');
  const [measurementMode, setMeasurementMode] = useState<'manual' | 'calculated'>('manual');
  const [gramsPerMeterInput, setGramsPerMeterInput] = useState('');
  const [basePriceLabelInput, setBasePriceLabelInput] = useState('');
  useToastMessageEffect(message, () => setMessage(null));

  const material = items?.find((item) => item.id === id);
  const itemMeasurements = measurements ?? [];
  const hasCalculatedMeasures = itemMeasurements.some((measurement) => measurement.pricing_mode === 'calculated');
  const basePriceLabel = material?.base_price_label?.trim() ? material.base_price_label.trim() : 'Precio base';

  const auditUserIds = useMemo(
    () => [material?.user_id, material?.updated_by].filter((value): value is string => Boolean(value)),
    [material?.updated_by, material?.user_id],
  );
  const { data: auditUsers } = useProfileDirectory(auditUserIds);
  const auditNamesById = useMemo(
    () =>
      new Map(
        (auditUsers ?? []).map((entry) => [entry.id, entry.full_name?.trim() ? entry.full_name.trim() : `Usuario ${entry.id.slice(0, 8)}`]),
      ),
    [auditUsers],
  );

  const categorySuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          (items ?? [])
            .filter((item) => item.item_type === 'material')
            .map((item) => item.category?.trim() ?? '')
            .filter((category) => category.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const latestBasePriceByStoreId = useMemo(() => {
    const map = new Map<string, LatestStoreItemPrice>();
    (latestBasePrices ?? [])
      .filter((row) => row.item_id === id)
      .forEach((row) => {
        map.set(row.store_id, row);
      });
    return map;
  }, [id, latestBasePrices]);

  const effectiveMeasureRowsByStoreId = useMemo(() => {
    const map = new Map<string, LatestStoreItemMeasurementPrice[]>();
    (latestMeasurePrices ?? []).forEach((row) => {
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
  }, [latestMeasurePrices]);

  const measurementStoreCounts = useMemo(() => {
    const map = new Map<string, number>();
    (latestMeasurePrices ?? []).forEach((row) => {
      map.set(row.item_measurement_id, (map.get(row.item_measurement_id) ?? 0) + 1);
    });
    return map;
  }, [latestMeasurePrices]);

  const availableStores = useMemo(() => stores ?? [], [stores]);
  const combinedError = itemsError ?? measurementsError ?? storesError ?? basePricesError ?? measurePricesError;

  const openNewMeasurementDialog = () => {
    setEditingMeasurement(null);
    setMeasurementLabel('');
    setMeasurementMode('manual');
    setGramsPerMeterInput('');
    setMeasurementDialogVisible(true);
  };

  const openEditMeasurementDialog = (measurement: ItemMeasurement) => {
    setEditingMeasurement(measurement);
    setMeasurementLabel(measurement.label);
    setMeasurementMode(measurement.pricing_mode);
    setGramsPerMeterInput(measurement.grams_per_meter == null ? '' : String(measurement.grams_per_meter));
    setMeasurementDialogVisible(true);
  };

  const closeMeasurementDialog = () => {
    if (saveMeasurement.isPending) return;
    setMeasurementDialogVisible(false);
  };

  const saveMeasurementChanges = async () => {
    if (!material) return;

    const normalizedLabel = measurementLabel.trim();
    if (!normalizedLabel) {
      setMessage('Completa la medida.');
      return;
    }

    const normalizedGramsPerMeter = measurementMode === 'calculated' ? parsePositiveNumberInput(gramsPerMeterInput) : null;
    if (measurementMode === 'calculated' && normalizedGramsPerMeter == null) {
      setMessage('Ingresa los gramos por metro para el calculo automatico.');
      return;
    }

    try {
      const payload: Partial<ItemMeasurement> & Pick<ItemMeasurement, 'item_id' | 'label' | 'pricing_mode'> = {
        item_id: material.id,
        label: normalizedLabel,
        pricing_mode: measurementMode,
        grams_per_meter: normalizedGramsPerMeter,
        unit: 'mt',
        sort_order: editingMeasurement?.sort_order ?? itemMeasurements.length,
      };

      if (editingMeasurement?.id) {
        payload.id = editingMeasurement.id;
      }

      await saveMeasurement.mutateAsync(payload);

      setMeasurementDialogVisible(false);
      setMessage(editingMeasurement ? 'Medida actualizada.' : 'Medida agregada.');
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo guardar la medida.'));
    }
  };

  return (
    <AppScreen
      showHomeButton={false}
      backLabel="Materiales"
      headerLeading={
        material ? (
          <View style={styles.titleRow}>
            <Text style={[styles.detailTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={2}>
              {material.name}
            </Text>
            <View style={[styles.categoryChip, { backgroundColor: getCategoryAccent(theme, material.category).backgroundColor }]}>
              <Text style={[styles.categoryChipText, { color: getCategoryAccent(theme, material.category).textColor }]} numberOfLines={1}>
                {material.category ?? 'Sin categoría'}
              </Text>
            </View>
          </View>
        ) : null
      }
      headerContent={
        material ? (
          <View style={[styles.tabs, { backgroundColor: theme.colors.surfaceVariant }]}>
            {DETAIL_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActiveTab(tab.key)}
                  style={[styles.tab, active && [styles.tabActive, { backgroundColor: theme.colors.surface }]]}
                >
                  <Text style={[styles.tabText, { color: active ? theme.colors.primary : theme.colors.textMuted }, active && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null
      }
    >
      <LoadingOrError
        isLoading={itemsLoading || measurementsLoading || storesLoading || basePricesLoading || measurePricesLoading}
        error={combinedError}
      />

      {material && activeTab === 'data' && (
        <ItemForm
          categorySuggestions={categorySuggestions}
          defaultValues={{
            name: material.name,
            item_type: 'material',
            category: material.category ?? '',
            description: material.description ?? '',
            notes: material.notes ?? '',
            sku: material.sku ?? '',
            base_price_label: material.base_price_label ?? '',
          }}
          onSubmit={async (values) => {
            try {
              await save.mutateAsync({
                id: material.id,
                name: values.name,
                item_type: 'material',
                category: values.category?.trim() ? values.category.trim() : null,
                base_price_label: values.base_price_label?.trim() ? values.base_price_label.trim() : null,
                unit: material.unit ?? 'mt',
                description: values.description?.trim() ? values.description.trim() : null,
                notes: values.notes?.trim() ? values.notes.trim() : null,
                brand: null,
              });
              setMessage('Material guardado.');
            } catch (saveError) {
              setMessage(toUserErrorMessage(saveError, 'No se pudo guardar el material.'));
            }
          }}
        />
      )}

      {material && activeTab === 'prices' && (
        <Card mode="outlined" style={[styles.measurementsCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
          <Card.Content style={styles.measurementsContent}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.titleOnSoft }]}>Medidas</Text>
              <Button mode="contained-tonal" icon="plus" onPress={openNewMeasurementDialog} buttonColor={theme.colors.accentSoft} textColor={theme.colors.accentStrong} style={styles.sectionHeaderAction}>
                Agregar
              </Button>
            </View>

            {itemMeasurements.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted }}>Todavía no hay medidas cargadas.</Text>
            ) : (
              itemMeasurements.map((measurement) => (
                <View key={measurement.id} style={[styles.measurementRow, { borderColor: theme.colors.borderSoft }]}>
                  <View style={styles.measurementInfo}>
                    <View style={styles.measurementHeader}>
                      <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>{measurement.label}</Text>
                      <View
                        style={[
                          styles.measurementBadge,
                          measurement.pricing_mode === 'calculated' ? styles.measurementBadgeCalculated : styles.measurementBadgeManual,
                        ]}
                      >
                        <Text style={styles.measurementBadgeText}>{measurement.pricing_mode === 'calculated' ? 'Calculada' : 'Manual'}</Text>
                      </View>
                    </View>
                    <Text style={{ color: theme.colors.textMuted }}>
                      {measurement.pricing_mode === 'calculated'
                        ? `${measurement.grams_per_meter} gr/mt desde ${basePriceLabel} (kg)`
                        : 'Precio manual por metro en cada tienda'}
                    </Text>
                    <Text style={{ color: theme.colors.textMuted }}>
                      {measurementStoreCounts.get(measurement.id) ?? 0} tienda{(measurementStoreCounts.get(measurement.id) ?? 0) === 1 ? '' : 's'} con precio
                    </Text>
                  </View>
                  <Button mode="text" onPress={() => openEditMeasurementDialog(measurement)}>
                    Editar
                  </Button>
                </View>
              ))
            )}

            {hasCalculatedMeasures ? (
              <View style={[styles.basePriceEditor, { borderColor: theme.colors.borderSoft }]}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>Base de calculo</Text>
                <Text style={{ color: theme.colors.textMuted }}>Este valor se usa para medidas automaticas en gr/mt.</Text>
                <TextInput
                  mode="outlined"
                  label="Referencia base (kg)"
                  value={basePriceLabelInput || (material.base_price_label ?? '')}
                  onChangeText={setBasePriceLabelInput}
                  outlineStyle={styles.inputOutline}
                  placeholder="Ej: Cobre"
                />
                <Button
                  mode="contained"
                  onPress={async () => {
                    try {
                      await save.mutateAsync({
                        id: material.id,
                        name: material.name,
                        item_type: 'material',
                        base_price_label: (basePriceLabelInput || (material.base_price_label ?? '')).trim() || null,
                      });
                      setMessage('Referencia base guardada.');
                    } catch (saveError) {
                      setMessage(toUserErrorMessage(saveError, 'No se pudo guardar la referencia base.'));
                    }
                  }}
                >
                  Guardar referencia
                </Button>
              </View>
            ) : null}
          </Card.Content>
        </Card>
      )}

      {material && activeTab === 'prices' && (
        <Card mode="outlined" style={[styles.pricesCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
          <Card.Content style={styles.pricesContent}>
            <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.titleOnSoft }]}>Precios por tienda</Text>
            {availableStores.length === 0 && <Text style={{ color: theme.colors.textMuted }}>No hay tiendas para asignar precio.</Text>}
            {availableStores.map((store) => {
              const latestBaseRow = latestBasePriceByStoreId.get(store.id) ?? null;
              const effectiveRows = effectiveMeasureRowsByStoreId.get(store.id) ?? [];
              const summary = formatStorePriceSummary(effectiveRows, latestBaseRow, hasCalculatedMeasures, material.base_price_label);

              return (
                <View key={store.id} style={[styles.storePriceRow, { borderBottomColor: theme.colors.borderSoft }]}>
                  <View style={styles.storePriceInfo}>
                    <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>{store.name}</Text>
                    <Text style={{ color: theme.colors.onSurface }}>{summary.primary}</Text>
                    {summary.secondary ? <Text style={{ color: theme.colors.onSurface }}>{summary.secondary}</Text> : null}
                    {summary.tertiary ? <Text style={{ color: theme.colors.textMuted }}>{summary.tertiary}</Text> : null}
                  </View>
                  <Link
                    href={{
                      pathname: '/prices/new',
                      params: { itemId: material.id, storeId: store.id },
                    }}
                    asChild
                  >
                    <Button
                      mode="contained-tonal"
                      style={styles.priceActionButton}
                      textColor={theme.colors.onSoftYellow}
                      buttonColor={theme.colors.softYellow}
                    >
                      {summary.hasPrice ? 'Actualizar' : 'Asignar'}
                    </Button>
                  </Link>
                </View>
              );
            })}
            <Button mode="text" onPress={() => router.push(`/prices/history/${material.id}`)}>
              Ver historial de precios
            </Button>
          </Card.Content>
        </Card>
      )}

      {material && activeTab === 'data' ? (
        <CatalogAuditCard
          createdBy={formatAuditActor(material.user_id, auditNamesById)}
          createdAt={formatDateTimeAr(material.created_at)}
          updatedBy={formatAuditActor(material.updated_by ?? material.user_id, auditNamesById)}
          updatedAt={formatDateTimeAr(material.updated_at)}
        />
      ) : null}

      <Portal>
        <AppDialog visible={measurementDialogVisible} onDismiss={closeMeasurementDialog}>
          <Dialog.Title>{editingMeasurement ? 'Editar medida' : 'Nueva medida'}</Dialog.Title>
          <Dialog.Content style={styles.measurementDialogContent}>
            <TextInput
              mode="outlined"
              label="Medida"
              value={measurementLabel}
              onChangeText={setMeasurementLabel}
              outlineStyle={styles.inputOutline}
              placeholder='Ej: 1/2'
            />
            <SegmentedButtons
              value={measurementMode}
              onValueChange={(value) => setMeasurementMode(value as 'manual' | 'calculated')}
              buttons={[
                { value: 'manual', label: 'Manual' },
                { value: 'calculated', label: 'Calculada' },
              ]}
            />
            {measurementMode === 'calculated' ? (
              <TextInput
                mode="outlined"
                label="Gramos por metro"
                value={gramsPerMeterInput}
                onChangeText={setGramsPerMeterInput}
                keyboardType="decimal-pad"
                outlineStyle={styles.inputOutline}
                placeholder="Ej: 270"
              />
            ) : (
              <Text style={{ color: theme.colors.textMuted }}>El precio se carga manualmente por tienda en $/mt.</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={closeMeasurementDialog} disabled={saveMeasurement.isPending}>
              Cancelar
            </Button>
            <Button onPress={saveMeasurementChanges} loading={saveMeasurement.isPending}>
              Guardar
            </Button>
          </Dialog.Actions>
        </AppDialog>
      </Portal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  detailTitle: { flexShrink: 1, fontSize: 20, lineHeight: 26, fontFamily: FONT_SANS_EXTRABOLD },
  categoryChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  categoryChipText: { fontSize: 12, lineHeight: 16, fontFamily: FONT_SANS_BOLD, maxWidth: 120 },
  tabs: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: 12, padding: 4, gap: 4 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 9 },
  tabActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabText: { fontSize: 13, fontFamily: FONT_SANS_SEMIBOLD },
  tabTextActive: { fontFamily: FONT_SANS_EXTRABOLD },
  inputOutline: {
    borderRadius: 10,
  },
  measurementsCard: {
    borderRadius: 16,
  },
  sectionTitle: {
    fontWeight: '800',
  },
  measurementsContent: {
    gap: 14,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeaderText: {
    gap: 4,
  },
  sectionHeaderAction: {
    alignSelf: 'flex-start',
  },
  measurementRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  measurementInfo: {
    flex: 1,
    gap: 4,
  },
  measurementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  measurementBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  measurementBadgeManual: {
    backgroundColor: '#EEF2F7',
  },
  measurementBadgeCalculated: {
    backgroundColor: '#E0F7FC',
  },
  measurementBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#334155',
  },
  basePriceEditor: {
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pricesCard: {
    borderRadius: 16,
  },
  pricesContent: {
    gap: 12,
    paddingVertical: 10,
  },
  storePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  storePriceInfo: {
    flex: 1,
    gap: 2,
  },
  priceActionButton: {
    borderRadius: 12,
    minWidth: 104,
  },
  measurementDialogContent: {
    gap: 12,
  },
});
