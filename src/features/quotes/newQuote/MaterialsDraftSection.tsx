import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Searchbar, Text, TextInput } from 'react-native-paper';

import { SelectionPanel, SelectionRow } from '@/components/SelectionPanel';
import { StorePicker } from '@/components/StorePicker';
import { QuoteItemsSummary, type SummaryRow } from '@/features/quotes/components/QuoteItemsSummary';
import { formatCurrencyArs } from '@/lib/format';
import { formatItemDisplayName, formatMeasuredItemDisplayName, formatMeasurementDisplayLabel } from '@/lib/itemDisplay';
import { useAppTheme } from '@/theme';
import type { Item, ItemMeasurement, Store } from '@/types/db';

interface Props {
  // Store
  stores: Store[];
  selectedStore: Store | null;
  setSelectedStoreId: (id: string | null) => void;
  selectedStoreId: string | null;
  materialCountByStoreId: Map<string, number>;
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
  stores,
  selectedStore,
  setSelectedStoreId,
  selectedStoreId,
  materialCountByStoreId,
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
            {selectedStore ? `Materiales de ${selectedStore.name}.` : 'Elegí la tienda y después su material.'}
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

        <StorePicker
          stores={stores}
          selectedStoreId={selectedStoreId}
          onSelect={setSelectedStoreId}
          materialCountByStoreId={materialCountByStoreId}
          disabled={disabled}
        />

        <Searchbar
          placeholder={selectedStoreId ? 'Buscar material' : 'Elegí una tienda primero'}
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
          <View style={[styles.selectedBanner, { backgroundColor: theme.colors.softGreen }]}>
            <Text style={[styles.selectedBannerText, { color: theme.colors.titleOnSoft }]} numberOfLines={1}>
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

        {selectedStoreId ? (
          <SelectionPanel
            data={filteredItems}
            keyExtractor={(item) => item.id}
            emptyText="No hay materiales con precio cargado en esa tienda."
            renderItem={(item) => {
              const directPrice = directPriceByItemId.get(item.id);
              return (
                <SelectionRow
                  title={item.name}
                  meta={[
                    item.category ?? 'Sin categoria',
                    measuredItemIds.has(item.id) ? 'Con medidas' : 'Precio directo',
                  ].join(' - ')}
                  trailing={directPrice != null ? formatCurrencyArs(directPrice) : 'Ver medidas'}
                  selected={item.id === selectedItemId}
                  tone="green"
                  disabled={disabled}
                  onPress={() => selectItem(item.id)}
                />
              );
            }}
          />
        ) : (
          <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
            Elegí una tienda para ver sus materiales.
          </Text>
        )}

        {selectedItem && hasMeasurements ? (
          <SelectionPanel
            data={itemMeasurements}
            keyExtractor={(measurement) => measurement.id}
            emptyText="Este material no tiene medidas cargadas."
            maxHeight={230}
            renderItem={(measurement) => {
              const measurementPrice = measurePriceByMeasurementId.get(measurement.id);
              return (
                <SelectionRow
                  title={formatMeasurementDisplayLabel(measurement) ?? measurement.label}
                  meta={
                    measurement.pricing_mode === 'calculated'
                      ? `${measurement.grams_per_meter ?? 0} gr/mt`
                      : 'Carga manual por mt'
                  }
                  trailing={measurementPrice != null ? `${formatCurrencyArs(measurementPrice)} / mt` : 'Sin precio'}
                  selected={measurement.id === selectedMeasurementId}
                  tone="green"
                  disabled={disabled}
                  onPress={() => selectMeasurement(measurement.id)}
                />
              );
            }}
          />
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
