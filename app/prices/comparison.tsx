import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Searchbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItemMeasurements, useItems } from '@/features/items/hooks';
import { useLatestMeasurePrices, useLatestPrices } from '@/features/prices/hooks';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';
import { formatMeasurementDisplayLabel } from '@/lib/itemDisplay';
import { useAppTheme } from '@/theme';

type ComparisonRow = {
  key: string;
  storeName: string;
  price: number;
  observedAt: string;
};

export default function PriceComparisonPage() {
  const theme = useAppTheme();
  const [search, setSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const itemsQuery = useItems();
  const directPricesQuery = useLatestPrices();
  const measurePricesQuery = useLatestMeasurePrices();
  const measurementsQuery = useItemMeasurements(selectedItemId);

  const items = useMemo(() => (itemsQuery.data ?? []).filter((item) => item.item_type === 'material'), [itemsQuery.data]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.category ?? '').toLowerCase().includes(query),
    );
  }, [items, search]);

  const itemMeasurements = measurementsQuery.data ?? [];
  const hasMeasurements = itemMeasurements.length > 0;

  const comparisonRows = useMemo(() => {
    if (!selectedItemId) return [];

    if (hasMeasurements && selectedMeasurementId) {
      return (measurePricesQuery.data ?? [])
        .filter((row) => row.item_measurement_id === selectedMeasurementId)
        .map<ComparisonRow>((row) => ({
          key: row.id,
          storeName: row.store_name,
          price: Number(row.price),
          observedAt: row.observed_at,
        }))
        .sort((a, b) => a.price - b.price);
    }

    if (hasMeasurements) return [];

    return (directPricesQuery.data ?? [])
      .filter((row) => row.item_id === selectedItemId)
      .map<ComparisonRow>((row) => ({
        key: row.id,
        storeName: row.store_name,
        price: Number(row.price),
        observedAt: row.observed_at,
      }))
      .sort((a, b) => a.price - b.price);
  }, [directPricesQuery.data, hasMeasurements, measurePricesQuery.data, selectedItemId, selectedMeasurementId]);

  const loading = itemsQuery.isLoading || directPricesQuery.isLoading || measurePricesQuery.isLoading || (Boolean(selectedItemId) && measurementsQuery.isLoading);
  const error = itemsQuery.error ?? directPricesQuery.error ?? measurePricesQuery.error ?? measurementsQuery.error ?? null;

  return (
    <AppScreen title="Comparacion de precios">
      <LoadingOrError isLoading={loading} error={error} />

      <Searchbar placeholder="Buscar material" value={search} onChangeText={setSearch} style={styles.searchbar} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemsRow}>
        {filteredItems.map((item) => {
          const selected = item.id === selectedItemId;
          return (
            <Text
              key={item.id}
              onPress={() => {
                setSelectedItemId(item.id);
                setSelectedMeasurementId(null);
              }}
              style={[
                styles.itemChip,
                {
                  backgroundColor: selected ? theme.colors.softGreenStrong : theme.colors.surfaceSoft,
                  color: selected ? theme.colors.titleOnSoft : theme.colors.onSurface,
                  borderColor: selected ? theme.colors.softGreenStrong : theme.colors.borderSoft,
                },
              ]}
            >
              {item.name}
            </Text>
          );
        })}
      </ScrollView>

      {hasMeasurements ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemsRow}>
          {itemMeasurements.map((measurement) => {
            const selected = measurement.id === selectedMeasurementId;
            return (
              <Text
                key={measurement.id}
                onPress={() => setSelectedMeasurementId(measurement.id)}
                style={[
                  styles.measurementChip,
                  {
                    backgroundColor: selected ? theme.colors.softBlueStrong : theme.colors.surfaceSoft,
                    color: selected ? theme.colors.titleOnSoft : theme.colors.onSurface,
                    borderColor: selected ? theme.colors.softBlueStrong : theme.colors.borderSoft,
                  },
                ]}
              >
                {formatMeasurementDisplayLabel(measurement) ?? measurement.label}
              </Text>
            );
          })}
        </ScrollView>
      ) : null}

      <FlatList
        data={comparisonRows}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => (
          <Card style={{ marginBottom: 8 }}>
            <Card.Title
              title={`${index === 0 ? 'Mejor precio · ' : ''}${item.storeName}`}
              subtitle={`${formatCurrencyArs(item.price)} · ${formatDateAr(item.observedAt)}`}
            />
          </Card>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ color: theme.colors.textMuted }}>
              {selectedItemId
                ? hasMeasurements && !selectedMeasurementId
                  ? 'Selecciona una medida para comparar.'
                  : 'Sin precios cargados para esta seleccion.'
                : 'Elige un material para comparar precios entre tiendas.'}
            </Text>
          </View>
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchbar: {
    borderRadius: 12,
  },
  itemsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  itemChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
    fontWeight: '600',
  },
  measurementChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    overflow: 'hidden',
    fontWeight: '600',
  },
  emptyState: {
    paddingTop: 12,
  },
});
