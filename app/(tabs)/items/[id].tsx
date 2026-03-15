import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Snackbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { ItemForm } from '@/features/items/ItemForm';
import { useItems, useSaveItem } from '@/features/items/hooks';
import { useLatestPrices } from '@/features/prices/hooks';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';
import type { LatestStoreItemPrice } from '@/types/db';

export default function ItemDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const { data: latestPrices, isLoading: pricesLoading, error: pricesError } = useLatestPrices();
  const save = useSaveItem();
  const [message, setMessage] = useState<string | null>(null);

  const material = items?.find((item) => item.id === id);
  const categorySuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          (items ?? [])
            .filter((item) => item.item_type === 'material')
            .map((item) => item.category?.trim() ?? '')
            .filter((category) => category.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const latestPriceByStoreId = useMemo(() => {
    const map = new Map<string, LatestStoreItemPrice>();
    (latestPrices ?? [])
      .filter((row) => row.item_id === id)
      .forEach((row) => {
        map.set(row.store_id, row);
      });
    return map;
  }, [id, latestPrices]);

  const availableStores = useMemo(() => stores ?? [], [stores]);
  const combinedError = itemsError ?? storesError ?? pricesError;

  return (
    <AppScreen title="Detalle de material" showHomeButton={false}>
      <LoadingOrError isLoading={itemsLoading || storesLoading || pricesLoading} error={combinedError} />

      {material && (
        <ItemForm
          categorySuggestions={categorySuggestions}
          defaultValues={{
            name: material.name,
            item_type: 'material',
            category: material.category ?? '',
            unit: material.unit ?? '',
            description: material.description ?? '',
            notes: material.notes ?? '',
          }}
          onSubmit={async (values) => {
            try {
              await save.mutateAsync({
                id: material.id,
                name: values.name,
                item_type: 'material',
                category: values.category?.trim() ? values.category.trim() : null,
                unit: values.unit?.trim() ? values.unit.trim() : null,
                description: values.description?.trim() ? values.description.trim() : null,
                notes: values.notes?.trim() ? values.notes.trim() : null,
              });
              setMessage('Material guardado.');
            } catch (saveError) {
              setMessage(toUserErrorMessage(saveError, 'No se pudo guardar el material.'));
            }
          }}
        />
      )}

      {material && (
        <Card mode="outlined" style={styles.pricesCard}>
          <Card.Content style={styles.pricesContent}>
            <Text variant="titleMedium">Precios por tienda</Text>
            {availableStores.length === 0 && <Text>No hay tiendas para asignar precio.</Text>}
            {availableStores.map((store) => {
              const row = latestPriceByStoreId.get(store.id);
              return (
                <View key={store.id} style={styles.storePriceRow}>
                  <View style={styles.storePriceInfo}>
                    <Text variant="titleSmall">{store.name}</Text>
                    <Text>{row ? formatCurrencyArs(row.price) : 'Sin precio asignado'}</Text>
                    {row ? <Text style={styles.rowDate}>Ultimo registro: {formatDateAr(row.observed_at)}</Text> : null}
                  </View>
                  <Link
                    href={{
                      pathname: '/prices/new',
                      params: { itemId: material.id, storeId: store.id },
                    }}
                    asChild
                  >
                    <Button mode={row ? 'outlined' : 'contained-tonal'}>{row ? 'Actualizar' : 'Asignar'}</Button>
                  </Link>
                </View>
              );
            })}
            <Button mode="text" onPress={() => router.push(`/prices/history/${material.id}`)}>
              Ver historial de precios
            </Button>
          </Card.Content>
        </Card>
      )}

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pricesCard: {
    borderRadius: 12,
  },
  pricesContent: {
    gap: 12,
    paddingVertical: 10,
  },
  storePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE4EC',
  },
  storePriceInfo: {
    flex: 1,
    gap: 2,
  },
  rowDate: {
    color: '#5f6368',
  },
});
