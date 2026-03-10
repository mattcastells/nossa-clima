import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Searchbar, Snackbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useAddQuoteServiceItem } from '@/features/quotes/hooks';
import { QuoteServiceItemFormValues, quoteServiceItemSchema } from '@/features/quotes/schemas';
import { useServices } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs } from '@/lib/format';

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

  const selectedService =
    filteredServices.find((service) => service.id === selectedServiceId) ??
    (services ?? []).find((service) => service.id === selectedServiceId);

  return (
    <AppScreen title="Agregar servicio">
      <LoadingOrError isLoading={servicesLoading} error={serviceError} />
      <View style={styles.container}>
        <Text style={styles.helperText}>Selecciona el tipo de servicio desde la lista de servicios cargados.</Text>
        <Searchbar
          placeholder="Buscar servicio por nombre o categoria"
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
        />

        <FlatList
          data={filteredServices}
          keyExtractor={(item) => item.id}
          style={styles.servicesList}
          contentContainerStyle={styles.servicesListContent}
          renderItem={({ item }) => (
            <Card
              mode="outlined"
              onPress={() => {
                setValue('service_id', item.id, { shouldValidate: true });
                setValue('unit_price', item.base_price, { shouldValidate: true });
              }}
              style={[styles.serviceCard, selectedServiceId === item.id && styles.serviceCardSelected]}
            >
              <Card.Content style={styles.serviceCardContent}>
                <Text variant="titleMedium">{item.name}</Text>
                <Text>{item.category ?? 'Sin categoria'} - Precio base: {formatCurrencyArs(item.base_price)}</Text>
              </Card.Content>
            </Card>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay servicios activos que coincidan con la busqueda.</Text>}
        />

        <View style={styles.selectionSummary}>
          <Text>Tipo seleccionado: {selectedService?.name ?? 'Ninguno'}</Text>
          <Text>Precio base sugerido: {formatCurrencyArs(selectedService?.base_price ?? 0)}</Text>
        </View>

        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Cantidad"
              keyboardType="decimal-pad"
              value={String(field.value)}
              onChangeText={field.onChange}
              outlineStyle={styles.inputOutline}
            />
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
              outlineStyle={styles.inputOutline}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Notas"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              outlineStyle={styles.inputOutline}
            />
          )}
        />

        <Text variant="titleMedium" style={styles.totalText}>
          Total estimado: {formatCurrencyArs((Number(quantity) || 0) * (Number(unitPrice) || 0))}
        </Text>

        <Button
          mode="contained"
          loading={add.isPending}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
          onPress={handleSubmit(async (values) => {
            try {
              await add.mutateAsync({
                quote_id: values.quote_id,
                service_id: values.service_id,
                quantity: Number(values.quantity),
                unit_price: Number(values.unit_price),
                notes: values.notes?.trim() ? values.notes.trim() : null,
              });
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
      <Snackbar visible={Boolean(snack)} onDismiss={() => setSnack(null)} duration={2400}>
        {snack}
      </Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  helperText: {
    color: '#5f6368',
    lineHeight: 20,
  },
  searchbar: {
    borderRadius: 10,
  },
  servicesList: {
    maxHeight: 260,
  },
  servicesListContent: {
    paddingTop: 2,
    paddingBottom: 6,
  },
  serviceCard: {
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6DEE8',
  },
  serviceCardSelected: {
    borderWidth: 2,
    borderColor: '#0B6E4F',
  },
  serviceCardContent: {
    gap: 4,
  },
  emptyText: {
    color: '#5f6368',
    paddingVertical: 6,
  },
  selectionSummary: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F7FAFC',
    gap: 4,
  },
  inputOutline: {
    borderRadius: 10,
  },
  totalText: {
    marginTop: 2,
    marginBottom: 2,
  },
  submitButton: {
    borderRadius: 10,
    marginTop: 4,
  },
  submitButtonContent: {
    minHeight: 42,
  },
});

