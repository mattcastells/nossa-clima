import { Link } from 'expo-router';
import { FlatList } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useLatestMeasurePrices, useLatestPrices } from '@/features/prices/hooks';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';
import { formatMeasuredItemDisplayName } from '@/lib/itemDisplay';

type PriceListRow = {
  key: string;
  itemId: string;
  title: string;
  subtitle: string;
  observedAt: string;
};

export default function PricesScreen() {
  const latestPricesQuery = useLatestPrices();
  const latestMeasurePricesQuery = useLatestMeasurePrices();

  const measureRows = latestMeasurePricesQuery.data ?? [];
  const measuredItemIds = new Set(measureRows.map((row) => row.item_id));
  const directRows = (latestPricesQuery.data ?? []).filter((row) => !measuredItemIds.has(row.item_id));

  const data: PriceListRow[] = [
    ...measureRows.map((row) => ({
      key: `measure-${row.id}`,
      itemId: row.item_id,
      title: `${formatMeasuredItemDisplayName({ name: row.item_name }, { label: row.item_measurement_label, unit: row.measurement_unit })} en ${row.store_name}`,
      subtitle: `${formatCurrencyArs(row.price)} / ${row.measurement_unit} · ${formatDateAr(row.observed_at)}${row.price_origin === 'calculated' ? ' · calculado' : ''}`,
      observedAt: row.observed_at,
    })),
    ...directRows.map((row) => ({
      key: `direct-${row.id}`,
      itemId: row.item_id,
      title: `${row.item_name} en ${row.store_name}`,
      subtitle: `${formatCurrencyArs(row.price)} · ${formatDateAr(row.observed_at)}`,
      observedAt: row.observed_at,
    })),
  ].sort((a, b) => b.observedAt.localeCompare(a.observedAt));

  const loading = latestPricesQuery.isLoading || latestMeasurePricesQuery.isLoading;
  const error = latestPricesQuery.error ?? latestMeasurePricesQuery.error ?? null;

  return (
    <AppScreen title="Precios">
      <Link href="/items" asChild>
        <Button mode="contained">Elegir material</Button>
      </Link>

      <LoadingOrError isLoading={loading} error={error} />

      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <Link href={`/prices/history/${item.itemId}`} asChild>
            <Card style={{ marginBottom: 8 }}>
              <Card.Title title={item.title} subtitle={item.subtitle} />
            </Card>
          </Link>
        )}
        ListEmptyComponent={<Text>Sin precios registrados. Carga el primero desde un material.</Text>}
      />

      <Link href="/prices/comparison" asChild>
        <Button mode="outlined">Comparar por material</Button>
      </Link>
    </AppScreen>
  );
}
