import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, View } from 'react-native';
import { Button, Card, Searchbar, SegmentedButtons, Snackbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems } from '@/features/items/hooks';
import { useAddQuoteMaterialItem, useSuggestedMaterialPrice } from '@/features/quotes/hooks';
import { QuoteMaterialItemFormValues, quoteMaterialItemSchema } from '@/features/quotes/schemas';
import { useStores } from '@/features/stores/hooks';
import { formatCurrencyArs } from '@/lib/format';
import { toUserErrorMessage } from '@/lib/errors';

export default function AddMaterialToQuotePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const add = useAddQuoteMaterialItem();

  const combinedError = itemsError ? new Error(itemsError.message) : storesError ? new Error(storesError.message) : null;

  const [search, setSearch] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  const { control, handleSubmit, watch, setValue } = useForm<QuoteMaterialItemFormValues>({
    resolver: zodResolver(quoteMaterialItemSchema),
    defaultValues: {
      quote_id: id,
      item_id: '',
      quantity: 1,
      unit_price: 0,
      margin_percent: null,
      source_store_id: null,
      unit: '',
      notes: '',
    },
  });

  const selectedItemId = watch('item_id');
  const marginPercent = watch('margin_percent');
  const sourceStoreId = watch('source_store_id');
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');

  const filteredItems = useMemo(
    () =>
      (items ?? [])
        .filter((i) => i.is_active)
        .filter((i) => {
          const q = search.toLowerCase();
          return i.name.toLowerCase().includes(q) || (i.category ?? '').toLowerCase().includes(q) || (i.brand ?? '').toLowerCase().includes(q);
        }),
    [items, search],
  );

  const selectedItem = filteredItems.find((i) => i.id === selectedItemId) ?? (items ?? []).find((i) => i.id === selectedItemId);

  const suggestion = useSuggestedMaterialPrice(selectedItemId, marginPercent, sourceStoreId);

  return (
    <AppScreen title="Agregar material">
      <LoadingOrError isLoading={itemsLoading || storesLoading} error={combinedError} />
      <View style={{ gap: 8 }}>
        <Searchbar placeholder="Buscar ítem por nombre/categoría/marca" value={search} onChangeText={setSearch} />

        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 240 }}
          renderItem={({ item }) => (
            <Card
              onPress={() => {
                setValue('item_id', item.id);
                if (item.unit) {
                  setValue('unit', item.unit);
                }
              }}
              style={{ marginBottom: 6, borderWidth: selectedItemId === item.id ? 2 : 0 }}
            >
              <Card.Content>
                <Text variant="titleMedium">{item.name}</Text>
                <Text>{item.category ?? 'Sin categoría'} · {item.brand ?? 'Sin marca'} · {item.unit ?? 'Sin unidad'}</Text>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={<Text>No hay ítems activos que coincidan con la búsqueda.</Text>}
        />

        <Text>Seleccionado: {selectedItem?.name ?? 'Ninguno'}</Text>

        <Controller
          control={control}
          name="source_store_id"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value ?? ''}
              onValueChange={(value) => field.onChange(value || null)}
              buttons={[
                { value: '', label: 'Sin tienda' },
                ...((stores ?? []).filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name })) ?? []),
              ]}
            />
          )}
        />
        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <TextInput mode="outlined" label="Cantidad" keyboardType="decimal-pad" value={String(field.value)} onChangeText={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="margin_percent"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Margen % (opcional)"
              keyboardType="decimal-pad"
              value={field.value == null ? '' : String(field.value)}
              onChangeText={(value) => field.onChange(value ? Number(value) : null)}
            />
          )}
        />
        <Button mode="outlined" onPress={() => setValue('unit_price', suggestion.data?.suggestedUnitPrice ?? 0)}>
          Usar precio sugerido
        </Button>
        <Text>Costo base detectado: {formatCurrencyArs(suggestion.data?.baseCost ?? 0)}</Text>
        <Controller
          control={control}
          name="unit_price"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Precio unitario"
              keyboardType="decimal-pad"
              value={String(field.value)}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => <TextInput mode="outlined" label="Notas" value={field.value} onChangeText={field.onChange} />}
        />

        <Text variant="titleMedium">Total estimado: {formatCurrencyArs((Number(quantity) || 0) * (Number(unitPrice) || 0))}</Text>

        <Button
          mode="contained"
          loading={add.isPending}
          onPress={handleSubmit(async (values) => {
            try {
              await add.mutateAsync(values);
              setSnack('Material agregado');
              router.back();
            } catch (mutationError) {
              setSnack(toUserErrorMessage(mutationError, 'No se pudo agregar el material'));
            }
          })}
        >
          Agregar material
        </Button>
      </View>

      <Snackbar visible={Boolean(snack)} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </AppScreen>
  );
}
