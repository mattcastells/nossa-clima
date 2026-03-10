import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button, SegmentedButtons, Snackbar, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems } from '@/features/items/hooks';
import { useCreatePrice } from '@/features/prices/hooks';
import { PriceFormValues, priceSchema } from '@/features/prices/schemas';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';

export default function NewPricePage() {
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const createPrice = useCreatePrice();
  const [message, setMessage] = useState<string | null>(null);

  const { control, handleSubmit } = useForm<PriceFormValues>({
    resolver: zodResolver(priceSchema),
    defaultValues: {
      store_id: '',
      item_id: '',
      price: 0,
      currency: 'ARS',
      observed_at: new Date().toISOString().slice(0, 10),
      source_type: 'manual_update',
      quantity_reference: '',
      notes: '',
    },
  });

  const combinedError = storesError ? new Error(storesError.message) : itemsError ? new Error(itemsError.message) : null;

  return (
    <AppScreen title="Registrar precio">
      <LoadingOrError isLoading={storesLoading || itemsLoading} error={combinedError} />
      <View style={{ gap: 8 }}>
        <Controller
          control={control}
          name="store_id"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={(stores ?? []).filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
        />
        <Controller
          control={control}
          name="item_id"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={(items ?? []).filter((i) => i.is_active).map((i) => ({ value: i.id, label: i.name }))}
            />
          )}
        />
        <Controller
          control={control}
          name="price"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Precio"
              keyboardType="decimal-pad"
              value={String(field.value)}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="observed_at"
          render={({ field }) => (
            <TextInput mode="outlined" label="Fecha observada (YYYY-MM-DD)" value={field.value} onChangeText={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="source_type"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={[
                { value: 'purchase', label: 'Compra' },
                { value: 'manual_update', label: 'Manual' },
                { value: 'quote', label: 'Cotización' },
                { value: 'other', label: 'Otro' },
              ]}
            />
          )}
        />
        <Button
          mode="contained"
          loading={createPrice.isPending}
          disabled={createPrice.isPending}
          onPress={handleSubmit(async (values) => {
            try {
              await createPrice.mutateAsync({ ...values, observed_at: new Date(values.observed_at).toISOString() });
              router.back();
            } catch (error) {
              setMessage(toUserErrorMessage(error, 'No se pudo registrar el precio.'));
            }
          })}
        >
          Guardar precio
        </Button>
      </View>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}
