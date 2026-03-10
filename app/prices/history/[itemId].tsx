import { useLocalSearchParams } from 'expo-router';
import { FlatList } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItemPriceHistory } from '@/features/prices/hooks';

export default function ItemHistoryPage() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { data, isLoading, error } = useItemPriceHistory(itemId);

  return (
    <AppScreen title="Historial de precios">
      <LoadingOrError isLoading={isLoading} error={error} />
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 8 }}>
            <Card.Title
              title={`${item.item_name} · ${item.store_name}`}
              subtitle={`$${item.price} · ${new Date(item.observed_at).toLocaleString()}`}
            />
          </Card>
        )}
        ListEmptyComponent={<Text>Sin historial para este ítem.</Text>}
      />
    </AppScreen>
  );
}
