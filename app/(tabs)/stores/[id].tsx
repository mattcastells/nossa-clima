import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Card, DataTable, Snackbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { StoreForm } from '@/features/stores/StoreForm';
import { useSaveStore, useStoreLatestPrices, useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';

export default function StoreDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useStores();
  const { data: priceRows, isLoading: pricesLoading, error: pricesError } = useStoreLatestPrices(id ?? '');
  const save = useSaveStore();
  const [message, setMessage] = useState<string | null>(null);
  const store = data?.find((s) => s.id === id);

  return (
    <AppScreen title="Detalle de tienda">
      <LoadingOrError isLoading={isLoading} error={error} />
      {store && (
        <StoreForm
          defaultValues={store}
          onSubmit={async (values) => {
            try {
              await save.mutateAsync({ ...values, id: store.id });
              router.back();
            } catch (saveError) {
              setMessage(toUserErrorMessage(saveError, 'No se pudo guardar la tienda.'));
            }
          }}
        />
      )}

      <Card mode="outlined">
        <Card.Title title="Items y precios en esta tienda" />
        <Card.Content>
          <LoadingOrError isLoading={pricesLoading} error={pricesError ? new Error(pricesError.message) : null} />
          {!pricesLoading && (priceRows?.length ?? 0) === 0 && <Text>No hay items asociados con precio en esta tienda.</Text>}
          {(priceRows?.length ?? 0) > 0 && (
            <ScrollView horizontal>
              <DataTable>
                <DataTable.Header>
                  <DataTable.Title style={{ minWidth: 220 }}>Item</DataTable.Title>
                  <DataTable.Title numeric style={{ minWidth: 140 }}>
                    Precio
                  </DataTable.Title>
                  <DataTable.Title style={{ minWidth: 140 }}>Fecha</DataTable.Title>
                </DataTable.Header>

                {priceRows?.map((row) => (
                  <DataTable.Row key={row.id}>
                    <DataTable.Cell style={{ minWidth: 220 }}>{row.item_name}</DataTable.Cell>
                    <DataTable.Cell numeric style={{ minWidth: 140 }}>
                      {formatCurrencyArs(row.price)}
                    </DataTable.Cell>
                    <DataTable.Cell style={{ minWidth: 140 }}>{formatDateAr(row.observed_at)}</DataTable.Cell>
                  </DataTable.Row>
                ))}
              </DataTable>
            </ScrollView>
          )}
        </Card.Content>
      </Card>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}
