import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, ScrollView as RNScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Searchbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { AppDialog } from '@/components/AppDialog';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useAddQuoteServiceItem, useQuoteDetail, useUpdateQuoteServiceItem, useDeleteQuoteServiceItem } from '@/features/quotes/hooks';
import { QuoteItemsSummary, SummaryRow } from '@/features/quotes/components/QuoteItemsSummary';
import { QuoteServiceItemForm } from '@/features/quotes/components/QuoteServiceItemForm';
import { QuoteServiceItemFormValues, quoteServiceItemSchema } from '@/features/quotes/schemas';
import { useServices } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs } from '@/lib/format';
import { getSingleRouteParam } from '@/lib/routeParams';
import { BRAND_BLUE, useAppTheme } from '@/theme';

export default function AddServiceToQuotePage() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = getSingleRouteParam(params.id).trim();
  const router = useRouter();
  const theme = useAppTheme();
  const { data: services, isLoading: servicesLoading, error: servicesError } = useServices();
  const add = useAddQuoteServiceItem();

  const serviceError = servicesError ? new Error(servicesError.message) : null;

  const [search, setSearch] = useState('');
  const [snack, setSnack] = useState<string | null>(null);
  const addedCountRef = useRef(0);
  const [marginInput, setMarginInput] = useState('');
  const scrollRef = useRef<RNScrollView>(null);
  const toast = useAppToast();
  useToastMessageEffect(snack, () => setSnack(null));

  const { control, handleSubmit, watch, setValue, reset } = useForm<QuoteServiceItemFormValues>({
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

  /** Parse margin input for display calculations */
  const parsedMargin = (() => {
    const normalized = marginInput.trim().replace(',', '.');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  })();

  const baseTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  const effectiveTotal = parsedMargin != null ? Number((baseTotal * (1 + parsedMargin / 100)).toFixed(2)) : baseTotal;

  const quoteDetail = useQuoteDetail(id ?? '');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const updateService = useUpdateQuoteServiceItem();
  const deleteService = useDeleteQuoteServiceItem();
  const isQuoteCompleted = quoteDetail.data?.quote.status === 'completed';

  /** Reset form for next consecutive add — keeps search/filter state */
  const resetFormForNextAdd = useCallback(() => {
    reset({ quote_id: id, service_id: '', quantity: 1, unit_price: 0, notes: '' });
    setMarginInput('');
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [id, reset]);

  const serviceSummaryRows: SummaryRow[] = useMemo(
    () =>
      (quoteDetail.data?.services ?? []).map((s) => ({
        id: s.id,
        label: s.service_name_snapshot,
        quantityLabel: String(s.quantity),
        unitPrice: s.unit_price,
        totalPrice: s.total_price,
      })),
    [quoteDetail.data?.services],
  );

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
    <AppScreen title="Agregar servicio al trabajo" showHomeButton={false}>
      <LoadingOrError isLoading={servicesLoading} error={serviceError} />
      {quoteDetail.data ? (
        <View style={{ marginBottom: 8 }}>
          <QuoteItemsSummary
            title={`Servicios del trabajo (${serviceSummaryRows.length})`}
            rows={serviceSummaryRows}
            headerTint={theme.colors.softBlueStrong}
            emptyText="No hay servicios en el trabajo."
            disabled={isQuoteCompleted || updateService.isPending || deleteService.isPending}
            onEdit={(itemId) => setEditingServiceId(itemId)}
            onDelete={async (itemId) => {
              if (isQuoteCompleted) return;
              try { await deleteService.mutateAsync(itemId); } catch { /* noop */ }
            }}
          />
        </View>
      ) : null}
      <View style={styles.container}>
        <Searchbar
          placeholder="Buscar servicio"
          value={search}
          onChangeText={setSearch}
          inputStyle={styles.searchbarInput}
          style={[
            styles.searchbar,
            {
              backgroundColor: theme.dark ? '#2B3138' : theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.borderSoft,
            },
          ]}
        />

        <View
          style={[
            styles.servicesPanel,
            {
              backgroundColor: theme.dark ? '#1E2530' : '#F7FAFC',
              borderColor: theme.dark ? theme.colors.borderSoft : '#D6DEE8',
            },
          ]}
        >
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
                style={[
                  styles.serviceCard,
                  { borderColor: theme.dark ? theme.colors.borderSoft : '#D6DEE8' },
                  selectedServiceId === item.id && styles.serviceCardSelected,
                ]}
              >
                <Card.Content style={styles.serviceCardContent}>
                  <View style={styles.serviceCardHeader}>
                    <Text variant="titleMedium" style={styles.serviceName}>
                      {item.name}
                    </Text>
                    <View
                      style={[
                        styles.categoryTag,
                        {
                          backgroundColor: theme.dark ? theme.colors.softBlue : '#EAF0F7',
                          borderColor: theme.dark ? theme.colors.softBlueStrong : '#D5E0EE',
                        },
                      ]}
                    >
                      <Text variant="labelSmall" style={[styles.categoryTagText, { color: theme.dark ? theme.colors.titleOnSoft : BRAND_BLUE }]}>
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
              contentStyle={styles.inputContent}
              scrollEnabled
            />
          )}
        />

      <AppDialog visible={Boolean(editingServiceId)} onDismiss={() => setEditingServiceId(null)}>
        <Dialog.Title>Editar servicio</Dialog.Title>
        <Dialog.Content>
          {editingServiceId && quoteDetail.data ? (
            <QuoteServiceItemForm
              defaultValues={{
                quote_id: quoteDetail.data.quote.id,
                service_id: quoteDetail.data.services.find((s) => s.id === editingServiceId)?.service_id ?? '',
                quantity: quoteDetail.data.services.find((s) => s.id === editingServiceId)?.quantity ?? 1,
                unit_price: quoteDetail.data.services.find((s) => s.id === editingServiceId)?.unit_price ?? 0,
                notes: quoteDetail.data.services.find((s) => s.id === editingServiceId)?.notes ?? '',
              }}
              submitLabel="Guardar cambios"
              onSubmit={async (values) => {
                try {
                  await updateService.mutateAsync({ itemId: editingServiceId, payload: { quantity: values.quantity, unit_price: values.unit_price, notes: values.notes ?? null } });
                  setEditingServiceId(null);
                } catch (err) {
                  // noop - error handling via global toast if desired
                }
              }}
            />
          ) : null}
        </Dialog.Content>
      </AppDialog>
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
              contentStyle={styles.inputContent}
              scrollEnabled
            />
          )}
        />
        <TextInput
          mode="outlined"
          label="Margen % (opcional)"
          value={marginInput}
          onChangeText={setMarginInput}
          keyboardType="decimal-pad"
          outlineStyle={styles.inputOutline}
          placeholder="Ej: 15"
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
              contentStyle={styles.inputContentMultiline}
            />
          )}
        />

        <Text variant="titleMedium" style={styles.totalText}>
          Total estimado: {formatCurrencyArs(effectiveTotal)}
        </Text>

        <Button
          mode="contained"
          loading={add.isPending}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
          onPress={handleSubmit(async (values) => {
            try {
              // Apply margin to the unit_price before saving
              const finalUnitPrice = parsedMargin != null
                ? Number(((Number(values.unit_price) || 0) * (1 + parsedMargin / 100)).toFixed(2))
                : Number(values.unit_price);

              await add.mutateAsync({
                quote_id: values.quote_id,
                service_id: values.service_id,
                quantity: Number(values.quantity),
                unit_price: finalUnitPrice,
                margin_percent: null,
                notes: values.notes?.trim() ? values.notes.trim() : null,
              });
              addedCountRef.current += 1;
              const count = addedCountRef.current;
              toast.success(count > 1 ? `Servicio agregado (${count} en total).` : 'Servicio agregado.');
              resetFormForNextAdd();
            } catch (mutationError) {
              setSnack(toUserErrorMessage(mutationError, 'No se pudo agregar el servicio'));
            }
          })}
        >
          Agregar servicio al trabajo
        </Button>
        <Button mode="outlined" onPress={() => router.back()} style={styles.backButton}>
          Volver al trabajo
        </Button>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  searchbar: {
    borderRadius: 10,
  },
  searchbarInput: {
    paddingLeft: 4,
  },
  servicesPanel: {
    maxHeight: 300,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6DEE8',
    backgroundColor: '#F7FAFC',
    padding: 8,
    overflow: 'hidden',
  },
  servicesList: {
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
  inputOutline: {
    borderRadius: 10,
  },
  inputContent: {
    paddingHorizontal: 10,
  },
  inputContentMultiline: {
    paddingHorizontal: 10,
    paddingTop: 8,
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
  backButton: {
    borderRadius: 10,
    marginTop: 4,
  },
});
