import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { Button, Card, Menu, Snackbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems } from '@/features/items/hooks';
import { useCreatePrice, useLatestPrices } from '@/features/prices/hooks';
import { PriceFormValues, priceSchema } from '@/features/prices/schemas';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';

const getSingleParam = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] ?? '' : value ?? '');

export default function NewPricePage() {
  const params = useLocalSearchParams<{ itemId?: string | string[]; storeId?: string | string[] }>();
  const initialStoreId = getSingleParam(params.storeId).trim();
  const initialItemId = getSingleParam(params.itemId).trim();

  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: latestPrices, isLoading: pricesLoading, error: pricesError } = useLatestPrices();
  const createPrice = useCreatePrice();

  const [message, setMessage] = useState<string | null>(null);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);

  const availableStores = useMemo(() => (stores ?? []).sort((a, b) => a.name.localeCompare(b.name)), [stores]);
  const availableMaterials = useMemo(() => (items ?? []).filter((item) => item.item_type === 'material'), [items]);
  const selectedItem = availableMaterials.find((item) => item.id === initialItemId) ?? null;

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PriceFormValues>({
    resolver: zodResolver(priceSchema),
    defaultValues: {
      store_id: initialStoreId,
      item_id: initialItemId,
      price: 0,
      currency: 'ARS',
      observed_at: new Date().toISOString().slice(0, 10),
      quantity_reference: '',
      notes: '',
    },
  });

  const selectedStoreId = watch('store_id');
  const selectedStore = availableStores.find((store) => store.id === selectedStoreId) ?? null;
  const selectedItemName = selectedItem?.name ?? '';
  const selectedItemCategory = selectedItem?.category ?? '';

  const materialPrices = useMemo(() => {
    return availableStores.map((store) => {
      const latest = (latestPrices ?? []).find((row) => row.item_id === initialItemId && row.store_id === store.id) ?? null;
      return {
        storeId: store.id,
        storeName: store.name,
        latest,
      };
    });
  }, [availableStores, initialItemId, latestPrices]);

  const combinedError =
    storesError ? new Error(storesError.message) : itemsError ? new Error(itemsError.message) : pricesError ? new Error(pricesError.message) : null;

  return (
    <AppScreen title="Registrar precio" showHomeButton={false}>
      <LoadingOrError isLoading={storesLoading || itemsLoading || pricesLoading} error={combinedError} />

      {!storesLoading && !itemsLoading && !pricesLoading && !selectedItem ? (
        <Card mode="outlined" style={styles.formCard}>
          <Card.Content style={styles.emptySelectionContent}>
            <Text variant="titleSmall">Material no seleccionado</Text>
            <Text style={styles.helperText}>Para registrar un precio, primero entra al material que queres actualizar.</Text>
            <Link href="/items" asChild>
              <Button mode="contained">Ir a Materiales</Button>
            </Link>
          </Card.Content>
        </Card>
      ) : (
        <>
          <Card mode="outlined" style={styles.formCard}>
            <Card.Content style={styles.formContent}>
              <View style={styles.fieldGroup}>
                <Text variant="labelMedium">Material</Text>
                <View style={styles.readonlyField}>
                  <Text style={styles.readonlyValue}>{selectedItemName}</Text>
                  {selectedItemCategory ? <Text style={styles.readonlyMeta}>{selectedItemCategory}</Text> : null}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text variant="labelMedium">Local</Text>
                <Menu
                  visible={storeMenuVisible}
                  onDismiss={() => setStoreMenuVisible(false)}
                  anchor={
                    <Button
                      mode="outlined"
                      icon="chevron-down"
                      style={styles.selectButton}
                      contentStyle={styles.selectButtonContent}
                      onPress={() => setStoreMenuVisible(true)}
                    >
                      {selectedStore?.name ?? 'Seleccionar o crear local'}
                    </Button>
                  }
                >
                  {availableStores.map((store) => (
                    <Menu.Item
                      key={store.id}
                      title={store.name}
                      onPress={() => {
                        setValue('store_id', store.id, { shouldValidate: true });
                        setStoreMenuVisible(false);
                      }}
                    />
                  ))}
                  <Menu.Item
                    title="Crear local nuevo"
                    onPress={() => {
                      setStoreMenuVisible(false);
                      router.push({
                        pathname: '/stores/new',
                        params: {
                          returnTo: '/prices/new',
                          itemId: initialItemId,
                        },
                      });
                    }}
                  />
                </Menu>
                {errors.store_id ? <Text style={styles.errorText}>{errors.store_id.message}</Text> : null}
              </View>

              <Controller
                control={control}
                name="price"
                render={({ field }) => (
                  <TextInput
                    mode="outlined"
                    label="Precio"
                    placeholder="Ej. 120000"
                    keyboardType="decimal-pad"
                    value={field.value === 0 ? '' : String(field.value)}
                    onChangeText={field.onChange}
                    outlineStyle={styles.inputOutline}
                  />
                )}
              />
              {errors.price ? <Text style={styles.errorText}>{errors.price.message}</Text> : null}

              <Button
                mode="contained"
                loading={createPrice.isPending}
                disabled={createPrice.isPending}
                onPress={handleSubmit(async (values) => {
                  try {
                    await createPrice.mutateAsync({
                      store_id: values.store_id,
                      item_id: initialItemId,
                      price: values.price,
                      currency: 'ARS',
                      observed_at: new Date().toISOString(),
                      source_type: 'manual_update',
                      quantity_reference: null,
                      notes: null,
                    });
                    router.back();
                  } catch (error) {
                    setMessage(toUserErrorMessage(error, 'No se pudo registrar el precio.'));
                  }
                })}
                style={styles.saveButton}
                contentStyle={styles.saveButtonContent}
              >
                Actualizar
              </Button>
            </Card.Content>
          </Card>

          <Card mode="outlined" style={styles.tableCard}>
            <Card.Content style={styles.tableContent}>
              <View style={styles.tableHeaderBlock}>
                <Text variant="titleSmall">Locales y precios</Text>
                <Text style={styles.helperText}>Toca un local para seleccionarlo.</Text>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
                <View style={styles.tableFrame}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.headerCell, styles.storeColumn]}>Local</Text>
                    <Text style={[styles.headerCell, styles.priceColumn]}>Precio</Text>
                    <Text style={[styles.headerCell, styles.dateColumn]}>Fecha</Text>
                  </View>

                  {materialPrices.map(({ storeId, storeName, latest }, index) => {
                    const selected = storeId === selectedStoreId;

                    return (
                      <Pressable
                        key={storeId}
                        onPress={() => setValue('store_id', storeId, { shouldValidate: true })}
                        style={[
                          styles.tableRow,
                          index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                          selected && styles.tableRowSelected,
                        ]}
                      >
                        <Text style={[styles.rowCell, styles.storeColumn, styles.storeNameCell]}>{storeName}</Text>
                        <Text style={[styles.rowCell, styles.priceColumn, styles.priceValue]}>
                          {latest ? formatCurrencyArs(latest.price) : 'Sin precio'}
                        </Text>
                        <Text style={[styles.rowCell, styles.dateColumn]}>{latest ? formatDateAr(latest.observed_at) : '-'}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </Card.Content>
          </Card>
        </>
      )}

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderRadius: 12,
  },
  formContent: {
    gap: 12,
    paddingVertical: 8,
  },
  emptySelectionContent: {
    gap: 10,
    paddingVertical: 8,
  },
  fieldGroup: {
    gap: 6,
  },
  readonlyField: {
    borderWidth: 1,
    borderColor: '#C9D7E6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#F8FBFF',
    gap: 2,
  },
  readonlyValue: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  readonlyMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: '#5f6368',
  },
  selectButton: {
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  selectButtonContent: {
    minHeight: 44,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  inputOutline: {
    borderRadius: 10,
  },
  saveButton: {
    borderRadius: 10,
    marginTop: 4,
  },
  saveButtonContent: {
    minHeight: 44,
  },
  tableCard: {
    borderRadius: 12,
  },
  tableContent: {
    gap: 10,
    paddingVertical: 8,
  },
  tableHeaderBlock: {
    gap: 2,
  },
  helperText: {
    color: '#5f6368',
    fontSize: 12,
    lineHeight: 18,
  },
  tableScrollContent: {
    paddingBottom: 2,
  },
  tableFrame: {
    minWidth: 430,
    gap: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF2FB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerCell: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#27486B',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DCE4EC',
  },
  tableRowEven: {
    backgroundColor: '#FFFFFF',
  },
  tableRowOdd: {
    backgroundColor: '#F8FBFF',
  },
  tableRowSelected: {
    borderColor: '#0F766E',
    backgroundColor: '#ECFDF5',
  },
  rowCell: {
    fontSize: 13,
    lineHeight: 18,
  },
  storeColumn: {
    width: 165,
    paddingRight: 8,
  },
  priceColumn: {
    width: 110,
    paddingRight: 8,
  },
  dateColumn: {
    width: 90,
  },
  storeNameCell: {
    fontWeight: '500',
  },
  priceValue: {
    fontWeight: '600',
  },
  errorText: {
    color: '#B00020',
    fontSize: 12,
    lineHeight: 16,
  },
});
