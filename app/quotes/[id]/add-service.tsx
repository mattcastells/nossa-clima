import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, View } from 'react-native';
import { Button, Card, Searchbar, Snackbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useAddQuoteServiceItem } from '@/features/quotes/hooks';
import { QuoteServiceItemFormValues, quoteServiceItemSchema } from '@/features/quotes/schemas';
import { useServices } from '@/features/services/hooks';
import { formatCurrencyArs } from '@/lib/format';
import { toUserErrorMessage } from '@/lib/errors';

export default function AddServiceToQuotePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: services, isLoading: servicesLoading, error: servicesError } = useServices();
  const add = useAddQuoteServiceItem();

  const serviceError = servicesError ? new Error(servicesError.message) : null;

  const [search, setSearch] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  const { control, handleSubmit, watch, setValue } = useForm<QuoteServiceItemFormValues>({
    resolver: zodResolver(quoteServiceItemSchema),
    defaultValues: {
      quote_id: id,
      service_id: '',
      quantity: 1,
      unit_price: 0,
      notes: '',
    },
  });

  const selectedServiceId = watch('service_id');
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');

  const filteredServices = useMemo(
    () =>
      (services ?? [])
        .filter((service) => service.is_active)
        .filter((service) => {
          const q = search.toLowerCase();
          return service.name.toLowerCase().includes(q) || (service.category ?? '').toLowerCase().includes(q);
        }),
    [services, search],
  );

  const selectedService = filteredServices.find((service) => service.id === selectedServiceId) ?? (services ?? []).find((service) => service.id === selectedServiceId);

  return (
    <AppScreen title="Agregar servicio">
      <LoadingOrError isLoading={servicesLoading} error={serviceError} />
      <View style={{ gap: 8 }}>
        <Searchbar placeholder="Buscar servicio por nombre/categoría" value={search} onChangeText={setSearch} />

        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.id}
          style={{ maxHeight: 240 }}
          renderItem={({ item }) => (
            <Card
              onPress={() => {
                setValue('service_id', item.id);
                setValue('unit_price', item.base_price);
              }}
              style={{ marginBottom: 6, borderWidth: selectedServiceId === item.id ? 2 : 0 }}
            >
              <Card.Content>
                <Text variant="titleMedium">{item.name}</Text>
                <Text>{item.category ?? 'Sin categoría'} · Precio base: {formatCurrencyArs(item.base_price)}</Text>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={<Text>No hay servicios activos que coincidan con la búsqueda.</Text>}
        />

        <Text>Seleccionado: {selectedService?.name ?? 'Ninguno'}</Text>
        <Text>Precio base sugerido: {formatCurrencyArs(selectedService?.base_price ?? 0)}</Text>

        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <TextInput mode="outlined" label="Cantidad" keyboardType="decimal-pad" value={String(field.value)} onChangeText={field.onChange} />
          )}
        />
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
              setSnack('Servicio agregado');
              router.back();
            } catch (mutationError) {
              setSnack(toUserErrorMessage(mutationError, 'No se pudo agregar el servicio'));
            }
          })}
        >
          Agregar servicio
        </Button>
      </View>
      <Snackbar visible={Boolean(snack)} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </AppScreen>
  );
}
