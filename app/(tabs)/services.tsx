import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { Button, Card, Searchbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useServices } from '@/features/services/hooks';
import { formatCurrencyArs } from '@/lib/format';

export default function ServicesScreen() {
  const { data, isLoading, error } = useServices();
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () => (data ?? []).filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );

  return (
    <AppScreen title="Servicios">
      <Searchbar placeholder="Buscar servicio" value={search} onChangeText={setSearch} />
      <Link href="/services/new" asChild>
        <Button mode="contained">Nuevo servicio</Button>
      </Link>
      <LoadingOrError isLoading={isLoading} error={error} />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Link href={`/services/${item.id}`} asChild>
            <Card style={{ marginBottom: 8 }}>
              <Card.Title
                title={item.name}
                subtitle={`${item.category ?? 'Sin categoría'} · ${formatCurrencyArs(item.base_price)} · ${item.is_active ? 'Activo' : 'Archivado'}`}
              />
            </Card>
          </Link>
        )}
        ListEmptyComponent={<Text>Sin servicios registrados. Creá un servicio para usarlo en presupuestos.</Text>}
      />
    </AppScreen>
  );
}
