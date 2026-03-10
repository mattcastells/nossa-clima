import { Link } from 'expo-router';
import { FlatList } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useStores } from '@/features/stores/hooks';

export default function StoresScreen() {
  const { data, isLoading, error } = useStores();

  return (
    <AppScreen title="Tiendas">
      <Link href="/stores/new" asChild>
        <Button mode="contained">Nueva tienda</Button>
      </Link>
      <LoadingOrError isLoading={isLoading} error={error} />
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/stores/${item.id}`} asChild>
            <Card style={{ marginBottom: 8 }}>
              <Card.Title title={item.name} subtitle={item.is_active ? 'Activa' : 'Archivada'} />
            </Card>
          </Link>
        )}
        ListEmptyComponent={<Text>Sin tiendas registradas. Cargá tu primera tienda para registrar precios.</Text>}
      />
    </AppScreen>
  );
}
