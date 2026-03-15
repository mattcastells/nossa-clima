import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, View } from 'react-native';
import { Button, Card, Searchbar, SegmentedButtons, Snackbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems, useSaveItem } from '@/features/items/hooks';
import { useAddQuoteMaterialItem, useQuoteDetail, useSuggestedMaterialPrice } from '@/features/quotes/hooks';
import { getEffectiveMaterialMarginPercent, getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from '@/features/quotes/materialPricing';
import { QuoteMaterialItemFormValues, quoteMaterialItemSchema } from '@/features/quotes/schemas';
import { useStoreLatestPrices, useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs, formatPercent } from '@/lib/format';

type MaterialEntryMode = 'catalog' | 'manual';

export default function AddMaterialToQuotePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const quoteDetail = useQuoteDetail(id ?? '');
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const saveItem = useSaveItem();
  const add = useAddQuoteMaterialItem();

  const [search, setSearch] = useState('');
  const [entryMode, setEntryMode] = useState<MaterialEntryMode>('catalog');
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualUnit, setManualUnit] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  const { control, watch, setValue, getValues, trigger } = useForm<QuoteMaterialItemFormValues>({
    resolver: zodResolver(quoteMaterialItemSchema),
    defaultValues: {
      quote_id: id ?? '',
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
  const sourceStoreId = watch('source_store_id');
  const marginPercent = watch('margin_percent');
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');
  const defaultMarginPercent = quoteDetail.data?.quote.default_material_margin_percent ?? null;
  const effectiveMargin = getEffectiveMaterialMarginPercent(marginPercent, defaultMarginPercent);
  const effectiveUnitPrice = getMaterialEffectiveUnitPrice(unitPrice, marginPercent, defaultMarginPercent);
  const effectiveTotal = getMaterialEffectiveTotalPrice(quantity, unitPrice, marginPercent, defaultMarginPercent);
  const usesGlobalMargin = marginPercent == null && defaultMarginPercent != null;

  const storePricesQuery = useStoreLatestPrices(sourceStoreId ?? '');
  const storePriceRows = useMemo(() => storePricesQuery.data ?? [], [storePricesQuery.data]);

  const storePriceByItemId = useMemo(
    () => new Map(storePriceRows.map((row) => [row.item_id, row.price] as const)),
    [storePriceRows],
  );
  const storeItemIds = useMemo(() => new Set(storePriceRows.map((row) => row.item_id)), [storePriceRows]);

  const filteredItems = useMemo(() => {
    const baseItems = (items ?? []).filter((item) => item.item_type === 'material');
    const byStore = sourceStoreId ? baseItems.filter((item) => storeItemIds.has(item.id)) : baseItems;
    const q = search.trim().toLowerCase();

    if (!q) return byStore;

    return byStore.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.category ?? '').toLowerCase().includes(q) ||
        (item.brand ?? '').toLowerCase().includes(q),
    );
  }, [items, sourceStoreId, storeItemIds, search]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedItemId) ??
    (items ?? []).find((item) => item.id === selectedItemId);

  const suggestion = useSuggestedMaterialPrice(entryMode === 'catalog' ? selectedItemId : '', marginPercent, sourceStoreId);

  const loading = itemsLoading || storesLoading || quoteDetail.isLoading || (Boolean(sourceStoreId) && storePricesQuery.isLoading);
  const combinedError = itemsError
    ? new Error(itemsError.message)
    : storesError
      ? new Error(storesError.message)
      : quoteDetail.error
        ? new Error(quoteDetail.error.message)
      : storePricesQuery.error
        ? new Error(storePricesQuery.error.message)
        : null;

  const availableStores = stores ?? [];
  const selectedStore = availableStores.find((store) => store.id === sourceStoreId) ?? null;

  const submit = async () => {
    try {
      if (entryMode === 'catalog' && !selectedItemId) {
        throw new Error('Selecciona un material de la lista.');
      }

      if (entryMode === 'manual') {
        const normalizedManualName = manualName.trim();
        const normalizedManualUnit = manualUnit.trim();

        if (!normalizedManualName) {
          throw new Error('Ingresa el nombre del material manual.');
        }

        const createdItem = await saveItem.mutateAsync({
          name: normalizedManualName,
          item_type: 'material',
          category: manualCategory.trim() || null,
          unit: normalizedManualUnit || null,
          brand: manualBrand.trim() || null,
          notes: null,
        });

        setValue('item_id', createdItem.id, { shouldValidate: true });
        setValue('unit', normalizedManualUnit || '', { shouldValidate: true });
      }

      const isValid = await trigger();
      if (!isValid) {
        throw new Error('Completa los campos obligatorios del material.');
      }

      const values = getValues();

      await add.mutateAsync({
        quote_id: values.quote_id,
        item_id: values.item_id,
        quantity: Number(values.quantity),
        unit: values.unit?.trim() ? values.unit.trim() : null,
        unit_price: Number(values.unit_price),
        margin_percent: values.margin_percent == null ? null : Number(values.margin_percent),
        source_store_id: values.source_store_id ?? null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      });

      setSnack('Material agregado');
      router.back();
    } catch (error) {
      setSnack(toUserErrorMessage(error, 'No se pudo agregar el material.'));
    }
  };

  return (
    <AppScreen title="Agregar material al trabajo">
      <LoadingOrError isLoading={loading} error={combinedError} />

      <View style={{ gap: 12 }}>
        <Text variant="titleMedium">Modo de carga</Text>
        <SegmentedButtons
          value={entryMode}
          onValueChange={(value) => {
            const nextMode = value as MaterialEntryMode;
            setEntryMode(nextMode);
            setValue('item_id', '', { shouldValidate: true });
          }}
          buttons={[
            { value: 'catalog', label: 'Desde lista' },
            { value: 'manual', label: 'Manual' },
          ]}
        />

        <Text variant="titleMedium">Tienda de compra</Text>
        <FlatList
          data={[{ id: '', name: 'Sin tienda' }, ...availableStores.map((store) => ({ id: store.id, name: store.name }))]}
          keyExtractor={(item) => item.id || 'none'}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const selected = (sourceStoreId ?? '') === item.id;
            return (
              <Card
                onPress={() => setValue('source_store_id', item.id || null, { shouldValidate: true })}
                style={{ marginRight: 8, borderWidth: selected ? 2 : 0 }}
              >
                <Card.Content>
                  <Text>{item.name}</Text>
                </Card.Content>
              </Card>
            );
          }}
        />
        <Text>Seleccionada: {selectedStore?.name ?? 'Sin tienda'}</Text>

        {entryMode === 'catalog' ? (
          <>
            <Searchbar placeholder="Buscar item por nombre/categoria/marca" value={search} onChangeText={setSearch} />
            <FlatList
              data={filteredItems}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 240 }}
              renderItem={({ item }) => (
                <Card
                  onPress={() => {
                    setValue('item_id', item.id, { shouldValidate: true });
                    setValue('unit', item.unit ?? '', { shouldValidate: true });
                  }}
                  style={{ marginBottom: 10, borderWidth: selectedItemId === item.id ? 2 : 0 }}
                >
                  <Card.Content>
                    <Text variant="titleMedium">{item.name}</Text>
                    <Text>
                      {item.category ?? 'Sin categoria'} · {item.brand ?? 'Sin marca'} · {item.unit ?? 'Sin unidad'}
                    </Text>
                    {sourceStoreId && storePriceByItemId.has(item.id) && (
                      <Text>Ultimo precio en tienda: {formatCurrencyArs(storePriceByItemId.get(item.id) ?? 0)}</Text>
                    )}
                  </Card.Content>
                </Card>
              )}
              ListEmptyComponent={
                <Text>
                  {sourceStoreId
                    ? 'No hay items con precio cargado en la tienda seleccionada.'
                    : 'No hay items que coincidan con la busqueda.'}
                </Text>
              }
            />
            <Text>Material seleccionado: {selectedItem?.name ?? 'Ninguno'}</Text>
            <Text>Precio base sugerido: {formatCurrencyArs(suggestion.data?.baseCost ?? 0)}</Text>
          </>
        ) : (
          <>
            <TextInput mode="outlined" label="Nombre del material" value={manualName} onChangeText={setManualName} />
            <TextInput mode="outlined" label="Categoria (opcional)" value={manualCategory} onChangeText={setManualCategory} />
            <TextInput mode="outlined" label="Unidad (opcional)" value={manualUnit} onChangeText={setManualUnit} />
            <TextInput mode="outlined" label="Marca (opcional)" value={manualBrand} onChangeText={setManualBrand} />
          </>
        )}

        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <TextInput mode="outlined" label="Cantidad" keyboardType="decimal-pad" value={String(field.value)} onChangeText={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="unit"
          render={({ field }) => (
            <TextInput mode="outlined" label="Unidad (opcional)" value={field.value ?? ''} onChangeText={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="margin_percent"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Margen % (vacío = global)"
              keyboardType="decimal-pad"
              value={field.value == null ? '' : String(field.value)}
              onChangeText={(value) => field.onChange(value ? Number(value) : null)}
            />
          )}
        />

        <Button
          mode="outlined"
          disabled={entryMode !== 'catalog' || !selectedItemId}
          onPress={() => setValue('unit_price', suggestion.data?.baseCost ?? 0)}
        >
          Usar costo sugerido
        </Button>

        <Controller
          control={control}
          name="unit_price"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Costo unitario"
              keyboardType="decimal-pad"
              value={String(field.value)}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => <TextInput mode="outlined" label="Notas" value={field.value ?? ''} onChangeText={field.onChange} />}
        />

        <Text>Costo base sugerido: {formatCurrencyArs(suggestion.data?.baseCost ?? 0)}</Text>
        <Text>Margen efectivo: {formatPercent(effectiveMargin)}{usesGlobalMargin ? ' (global)' : ''}</Text>
        <Text>Precio de venta unitario estimado: {formatCurrencyArs(effectiveUnitPrice)}</Text>
        <Text variant="titleMedium">Total estimado: {formatCurrencyArs(effectiveTotal)}</Text>

        <Button mode="contained" loading={add.isPending || saveItem.isPending} onPress={submit}>
          Agregar material al trabajo
        </Button>
      </View>

      <Snackbar visible={Boolean(snack)} onDismiss={() => setSnack(null)}>
        {snack}
      </Snackbar>
    </AppScreen>
  );
}
