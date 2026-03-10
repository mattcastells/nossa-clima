import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { Button, Card, Searchbar, Snackbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useImportDefaultServices, useServices } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs } from '@/lib/format';

export default function ServicesScreen() {
  const { data, isLoading, error } = useServices();
  const importDefaults = useImportDefaultServices();
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const autoImportTriggered = useRef(false);

  const filtered = useMemo(
    () => (data ?? []).filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );

  useEffect(() => {
    if (autoImportTriggered.current || isLoading || importDefaults.isPending || Boolean(error)) return;
    autoImportTriggered.current = true;

    importDefaults.mutate(undefined, {
      onSuccess: (result) => {
        if (result.inserted > 0) {
          setMessage(`Se cargaron ${result.inserted} servicios base.`);
        }
      },
      onError: (mutationError) => {
        setMessage(toUserErrorMessage(mutationError, 'No se pudo cargar la lista base.'));
      },
    });
  }, [data, error, importDefaults, isLoading]);

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
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}
