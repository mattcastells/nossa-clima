import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Searchbar, Text, TextInput } from 'react-native-paper';

import { QuoteItemsSummary, type SummaryRow } from '@/features/quotes/components/QuoteItemsSummary';
import { formatCurrencyArs } from '@/lib/format';
import { formatItemDisplayName, formatMeasuredItemDisplayName, formatMeasurementDisplayLabel } from '@/lib/itemDisplay';
import { BRAND_BLUE, BRAND_BLUE_SOFT, BRAND_GREEN, BRAND_GREEN_SOFT, useAppTheme } from '@/theme';
import type { Item, ItemMeasurement, Store } from '@/types/db';

interface Props {
  // Store
  storeSearch: string;
  setStoreSearch: (v: string) => void;
  selectedStore: Store | null;
  setSelectedStoreId: (id: string | null) => void;
  filteredStores: Store[];
  selectedStoreId: string | null;
  // Item
  materialSearch: string;
  setMaterialSearch: (v: string) => void;
  selectedItem: Item | null;
  selectedItemId: string;
  selectItem: (itemId: string) => void;
  clearSelectedItem: () => void;
  filteredItems: Item[];
  directPriceByItemId: Map<string, number>;
  measuredItemIds: Set<string>;
  // Measurement
  selectedMeasurementId: string | null;
  selectedMeasurement: ItemMeasurement | null;
  selectMeasurement: (id: string) => void;
  itemMeasurements: ItemMeasurement[];
  hasMeasurements: boolean;
  measurePriceByMeasurementId: Map<string, number>;
  // Inputs
  materialQuantityInput: string;
  setMaterialQuantityInput: (v: string) => void;
  materialUnitPriceInput: string;
  setMaterialUnitPriceInput: (v: string) => void;
  materialNotesInput: string;
  setMaterialNotesInput: (v: string) => void;
  // Draft list
  summaryRows: SummaryRow[];
  previewTotal: number;
  addDraftMaterial: () => void;
  removeDraftMaterial: (id: string) => void;
  // State
  disabled: boolean;
}

export function MaterialsDraftSection({
  storeSearch,
  setStoreSearch,
  selectedStore,
  setSelectedStoreId,
  filteredStores,
  selectedStoreId,
  materialSearch,
  setMaterialSearch,
  selectedItem,
  selectedItemId,
  selectItem,
  clearSelectedItem,
  filteredItems,
  directPriceByItemId,
  measuredItemIds,
  selectedMeasurementId,
  selectedMeasurement,
  selectMeasurement,
  itemMeasurements,
  hasMeasurements,
  measurePriceByMeasurementId,
  materialQuantityInput,
  setMaterialQuantityInput,
  materialUnitPriceInput,
  setMaterialUnitPriceInput,
  materialNotesInput,
  setMaterialNotesInput,
  summaryRows,
  previewTotal,
  addDraftMaterial,
  removeDraftMaterial,
  disabled,
}: Props) {
  const theme = useAppTheme();

  const handleDelete = useCallback((id: string) => removeDraftMaterial(id), [removeDraftMaterial]);

  return (
    <Card mode="outlined" style={styles.sectionCard}>
      <Card.Content style={styles.sectionContent}>
        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">Materiales</Text>
          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
            Selecciona tienda y material para dejarlo listo desde esta pantalla.
          </Text>
        </View>

        <QuoteItemsSummary
          title={`Materiales del borrador (${summaryRows.length})`}
          rows={summaryRows}
          headerTint={theme.colors.softGreenStrong}
          emptyText="No agregaste materiales todavia."
          disabled={disabled}
          onDelete={handleDelete}
        />

        <Searchbar
          placeholder="Buscar tienda"
          value={storeSearch}
          onChangeText={setStoreSearch}
          style={[
            styles.searchbar,
            {
              backgroundColor: theme.dark ? theme.colors.background : theme.colors.surface,
              borderColor: theme.colors.borderSoft,
            },
          ]}
          inputStyle={styles.searchbarInput}
        />

        {selectedStore ? (
          <View style={[styles.selectedBanner, { backgroundColor: BRAND_BLUE_SOFT }]}>
            <Text style={[styles.selectedBannerText, { color: BRAND_BLUE }]} numberOfLines={1}>
              Tienda: {selectedStore.name}
            </Text>
            <Button compact mode="text" onPress={() => setSelectedStoreId(null)} disabled={disabled}>
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
                  <Text
                    style={selected ? styles.storeGridCellNameSelected : styles.storeGridCellName}
                    numberOfLines={1}
                  >
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
            <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
              No hay tiendas para mostrar.
            </Text>
          )}
        </View>

        <Searchbar
          placeholder={selectedStoreId ? 'Buscar material' : 'Selecciona una tienda primero'}
          value={materialSearch}
          onChangeText={setMaterialSearch}
          style={[
            styles.searchbar,
            {
              backgroundColor: theme.dark ? theme.colors.background : theme.colors.surface,
              borderColor: theme.colors.borderSoft,
            },
          ]}
          inputStyle={styles.searchbarInput}
          editable={Boolean(selectedStoreId)}
        />

        {selectedItem ? (
          <View style={[styles.selectedBanner, { backgroundColor: BRAND_GREEN_SOFT }]}>
            <Text style={[styles.selectedBannerText, { color: BRAND_GREEN }]} numberOfLines={1}>
              Material:{' '}
              {selectedMeasurement
                ? formatMeasuredItemDisplayName(selectedItem, selectedMeasurement)
                : formatItemDisplayName(selectedItem)}
            </Text>
            <Button compact mode="text" onPress={clearSelectedItem} disabled={disabled}>
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
                    onPress={() => selectItem(item.id)}
                    style={[styles.resultRow, selected && styles.materialResultRowSelected]}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle}>{item.name}</Text>
                      <Text style={styles.resultMeta}>
                        {[
                          item.category ?? 'Sin categoria',
                          measuredItemIds.has(item.id) ? 'Con medidas' : 'Precio directo',
                        ].join(' - ')}
                      </Text>
                    </View>
                    <Text style={styles.resultPrice}>
                      {directPrice != null ? formatCurrencyArs(directPrice) : 'Ver medidas'}
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                No hay materiales con precio cargado en esa tienda.
              </Text>
            )
          ) : (
            <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
              Primero selecciona una tienda para ver materiales.
            </Text>
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
                  onPress={() => selectMeasurement(measurement.id)}
                  style={[styles.measurementRow, selected && styles.materialResultRowSelected]}
                >
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultTitle}>
                      {formatMeasurementDisplayLabel(measurement) ?? measurement.label}
                    </Text>
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
            disabled={disabled}
          />
          <TextInput
            mode="outlined"
            label="Costo"
            value={materialUnitPriceInput}
            onChangeText={setMaterialUnitPriceInput}
            keyboardType="decimal-pad"
            outlineStyle={styles.inputOutline}
            style={styles.inlineField}
            disabled={disabled}
          />
        </View>
        <TextInput
          mode="outlined"
          label="Notas del material"
          value={materialNotesInput}
          onChangeText={setMaterialNotesInput}
          outlineStyle={styles.inputOutline}
          disabled={disabled}
        />
        <View style={styles.previewRow}>
          <Text style={[styles.previewLabel, { color: theme.colors.textMuted }]}>Total estimado</Text>
          <Text style={styles.previewValue}>{formatCurrencyArs(previewTotal)}</Text>
        </View>
        <Button mode="outlined" onPress={addDraftMaterial} disabled={disabled}>
          Agregar material
        </Button>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
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
});
