import { useState } from 'react';
import { FlatList } from 'react-native';
import { Card, SegmentedButtons, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useItems } from '@/features/items/hooks';
import { useLatestPrices } from '@/features/prices/hooks';

export default function PriceComparisonPage() {
  const [selectedItemId, setSelectedItemId] = useState('');
  const { data: items } = useItems();
  const { data: prices } = useLatestPrices();

  const filtered = (prices ?? [])
    .filter((p) => p.item_id === selectedItemId)
    .sort((a, b) => Number(a.price) - Number(b.price));

  return (
    <AppScreen title="Comparación por ítem">
      <SegmentedButtons
        value={selectedItemId}
        onValueChange={setSelectedItemId}
        buttons={(items ?? []).filter((i) => i.is_active).map((i) => ({ value: i.id, label: i.name }))}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Card style={{ marginBottom: 8 }}>
            <Card.Title
              title={`${index === 0 ? '🏆 ' : ''}${item.store_name}`}
              subtitle={`$${item.price} · ${new Date(item.observed_at).toLocaleDateString()}`}
            />
          </Card>
        )}
        ListEmptyComponent={<Text>Elegí un ítem para comparar precios entre tiendas.</Text>}
      />
    </AppScreen>
  );
}
