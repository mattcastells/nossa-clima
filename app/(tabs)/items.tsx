import { Link } from 'expo-router';
import { FlatList } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems } from '@/features/items/hooks';

export default function ItemsScreen() {
  const { data, isLoading, error } = useItems();

  return (
    <AppScreen title="Ítems">
      <Link href="/items/new" asChild>
        <Button mode="contained">Nuevo ítem</Button>
      </Link>
      <LoadingOrError isLoading={isLoading} error={error} />
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/items/${item.id}`} asChild>
            <Card style={{ marginBottom: 8 }}>
              <Card.Title title={item.name} subtitle={`${item.item_type} · ${item.is_active ? 'Activo' : 'Archivado'}`} />
            </Card>
          </Link>
        )}
        ListEmptyComponent={<Text>Sin ítems registrados.</Text>}
      />
    </AppScreen>
  );
}
