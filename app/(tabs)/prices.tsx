import { Link } from 'expo-router';
import { FlatList } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useLatestPrices } from '@/features/prices/hooks';

export default function PricesScreen() {
  const { data, isLoading, error } = useLatestPrices();

  return (
    <AppScreen title="Precios">
      <Link href="/prices/new" asChild>
        <Button mode="contained">Registrar precio</Button>
      </Link>
      <LoadingOrError isLoading={isLoading} error={error} />
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/prices/history/${item.item_id}`} asChild>
            <Card style={{ marginBottom: 8 }}>
              <Card.Title
                title={`${item.item_name} en ${item.store_name}`}
                subtitle={`$${item.price} · ${new Date(item.observed_at).toLocaleDateString()}`}
              />
            </Card>
          </Link>
        )}
        ListEmptyComponent={<Text>Sin precios registrados.</Text>}
      />
      <Link href="/prices/comparison" asChild>
        <Button mode="outlined">Comparar por ítem</Button>
      </Link>
    </AppScreen>
  );
}
