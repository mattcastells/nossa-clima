import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Searchbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useAddQuoteServiceItem } from '@/features/quotes/hooks';
import { QuoteServiceItemFormValues, quoteServiceItemSchema } from '@/features/quotes/schemas';
import { useServices } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs } from '@/lib/format';
import { BRAND_BLUE } from '@/theme';

export default function AddServiceToQuotePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: services, isLoading: servicesLoading, error: servicesError } = useServices();
  const add = useAddQuoteServiceItem();

  const serviceError = servicesError ? new Error(servicesError.message) : null;

  const [search, setSearch] = useState('');
  const [snack, setSnack] = useState<string | null>(null);
  const toast = useAppToast();
  useToastMessageEffect(snack, () => setSnack(null));

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
        .filter((service) => {
          const q = search.toLowerCase();
          return service.name.toLowerCase().includes(q) || (service.category ?? '').toLowerCase().includes(q);
        }),
    [services, search],
  );

  return (
    <AppScreen title="Agregar servicio al trabajo" showHomeButton={false} scrollable={false}>
      <LoadingOrError isLoading={servicesLoading} error={serviceError} />
      <View style={styles.container}>
        <Searchbar
          placeholder="Buscar servicio"
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
        />

        <View style={styles.servicesPanel}>
          <FlatList
            data={filteredServices}
            keyExtractor={(item) => item.id}
            nestedScrollEnabled
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
                  <View style={styles.serviceCardHeader}>
                    <Text variant="titleMedium" style={styles.serviceName}>
                      {item.name}
                    </Text>
                    <View style={styles.categoryTag}>
                      <Text variant="labelSmall" style={styles.categoryTagText}>
                        {item.category ?? 'Sin categoria'}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No hay servicios que coincidan con la busqueda.</Text>}
          />
        </View>

        <Text variant="titleSmall" style={styles.detailsHeading}>
          Detalles
        </Text>

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
              toast.success('Servicio agregado.');
              router.back();
            } catch (mutationError) {
              setSnack(toUserErrorMessage(mutationError, 'No se pudo agregar el servicio'));
            }
          })}
        >
          Agregar servicio al trabajo
        </Button>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 14,
  },
  searchbar: {
    borderRadius: 10,
  },
  servicesPanel: {
    flex: 1,
    minHeight: 280,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6DEE8',
    backgroundColor: '#F7FAFC',
    padding: 8,
    overflow: 'hidden',
  },
  servicesList: {
    flex: 1,
  },
  servicesListContent: {
    paddingTop: 2,
    paddingBottom: 10,
    gap: 10,
  },
  serviceCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D6DEE8',
  },
  serviceCardSelected: {
    borderWidth: 2,
    borderColor: BRAND_BLUE,
  },
  serviceCardContent: {
    gap: 4,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  serviceName: {
    flex: 1,
  },
  categoryTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EAF0F7',
    borderWidth: 1,
    borderColor: '#D5E0EE',
  },
  categoryTagText: {
    color: BRAND_BLUE,
  },
  emptyText: {
    color: '#5f6368',
    paddingVertical: 18,
    textAlign: 'center',
  },
  detailsHeading: {
    color: '#5f6368',
    marginTop: -2,
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

