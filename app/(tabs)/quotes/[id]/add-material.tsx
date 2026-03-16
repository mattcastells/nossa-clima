import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, Searchbar, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems, useSaveItem } from '@/features/items/hooks';
import { useCreatePrice, useLatestPrices } from '@/features/prices/hooks';
import { useAddQuoteMaterialItem, useQuoteDetail } from '@/features/quotes/hooks';
import { getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from '@/features/quotes/materialPricing';
import { QuoteMaterialItemFormValues, quoteMaterialItemSchema } from '@/features/quotes/schemas';
import { useStoreLatestPrices, useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs } from '@/lib/format';
import { BRAND_BLUE, BRAND_BLUE_SOFT, BRAND_GREEN, BRAND_GREEN_SOFT } from '@/theme';

type MaterialEntryMode = 'catalog' | 'manual';
const PAGE_SIZE = 5;

export default function AddMaterialToQuotePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const quoteDetail = useQuoteDetail(id ?? '');
  const { data: items, isLoading: itemsLoading, error: itemsError } = useItems();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();
  const latestPricesQuery = useLatestPrices();
  const saveItem = useSaveItem();
  const createPrice = useCreatePrice();
  const add = useAddQuoteMaterialItem();

  const [storeSearch, setStoreSearch] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [entryMode, setEntryMode] = useState<MaterialEntryMode>('catalog');
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualUnit, setManualUnit] = useState('');
  const [manualBrand, setManualBrand] = useState('');
  const [snack, setSnack] = useState<string | null>(null);
  const [storePage, setStorePage] = useState(1);
  const [materialPage, setMaterialPage] = useState(1);
  const toast = useAppToast();
  useToastMessageEffect(snack, () => setSnack(null));

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
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');

  const defaultMarginPercent = quoteDetail.data?.quote.default_material_margin_percent ?? null;
  const effectiveUnitPrice = getMaterialEffectiveUnitPrice(unitPrice, null, defaultMarginPercent);
  const effectiveTotal = getMaterialEffectiveTotalPrice(quantity, unitPrice, null, defaultMarginPercent);

  const storePricesQuery = useStoreLatestPrices(sourceStoreId ?? '');
  const availableStores = useMemo(() => (stores ?? []).slice().sort((a, b) => a.name.localeCompare(b.name)), [stores]);
  const latestPriceRows = useMemo(() => latestPricesQuery.data ?? [], [latestPricesQuery.data]);
  const storePriceRows = useMemo(() => storePricesQuery.data ?? [], [storePricesQuery.data]);

  const latestPriceByItemId = useMemo(() => {
    const map = new Map<string, number>();
    latestPriceRows.forEach((row) => {
      if (!map.has(row.item_id)) {
        map.set(row.item_id, row.price);
      }
    });
    return map;
  }, [latestPriceRows]);

  const storePriceByItemId = useMemo(() => new Map(storePriceRows.map((row) => [row.item_id, row.price] as const)), [storePriceRows]);
  const storeItemIds = useMemo(() => new Set(storePriceRows.map((row) => row.item_id)), [storePriceRows]);
  const catalogPriceByItemId = useMemo(
    () => (sourceStoreId ? storePriceByItemId : latestPriceByItemId),
    [latestPriceByItemId, sourceStoreId, storePriceByItemId],
  );

  const materialItems = useMemo(() => (items ?? []).filter((item) => item.item_type === 'material'), [items]);
  const catalogItems = useMemo(
    () => (sourceStoreId ? materialItems.filter((item) => storeItemIds.has(item.id)) : []),
    [materialItems, sourceStoreId, storeItemIds],
  );

  const filteredStores = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();
    if (!query) return availableStores;

    return availableStores.filter(
      (store) =>
        store.name.toLowerCase().includes(query) ||
        (store.description ?? '').toLowerCase().includes(query) ||
        (store.address ?? '').toLowerCase().includes(query),
    );
  }, [availableStores, storeSearch]);

  const filteredItems = useMemo(() => {
    const query = materialSearch.trim().toLowerCase();
    if (!query) return catalogItems;

    return catalogItems.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        (item.category ?? '').toLowerCase().includes(query) ||
        (item.brand ?? '').toLowerCase().includes(query),
    );
  }, [catalogItems, materialSearch]);

  const selectedItem =
    filteredItems.find((item) => item.id === selectedItemId) ??
    catalogItems.find((item) => item.id === selectedItemId) ??
    materialItems.find((item) => item.id === selectedItemId) ??
    null;

  const totalStorePages = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));
  const paginatedStores = useMemo(() => {
    const startIndex = (storePage - 1) * PAGE_SIZE;
    return filteredStores.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredStores, storePage]);

  const totalMaterialPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const paginatedMaterials = useMemo(() => {
    const startIndex = (materialPage - 1) * PAGE_SIZE;
    return filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredItems, materialPage]);

  const getListPrice = (itemId: string) => {
    return Number(catalogPriceByItemId.get(itemId) ?? 0);
  };

  useEffect(() => {
    if (entryMode !== 'catalog') return;
    if (!sourceStoreId || !selectedItemId) return;
    if (storeItemIds.has(selectedItemId)) return;

    setValue('item_id', '', { shouldValidate: true });
    setValue('unit', '', { shouldValidate: true });
    setValue('unit_price', 0, { shouldValidate: true });
  }, [entryMode, selectedItemId, setValue, sourceStoreId, storeItemIds]);

  useEffect(() => {
    if (entryMode !== 'catalog') return;
    if (!selectedItem) return;

    const nextUnit = selectedItem.unit ?? '';
    if ((getValues('unit') ?? '') !== nextUnit) {
      setValue('unit', nextUnit, { shouldValidate: true });
    }

    const nextPrice = Number(catalogPriceByItemId.get(selectedItem.id) ?? 0);
    if (Number(getValues('unit_price')) !== nextPrice) {
      setValue('unit_price', nextPrice, { shouldValidate: true });
    }
  }, [catalogPriceByItemId, entryMode, getValues, selectedItem, setValue]);

  useEffect(() => {
    setStorePage(1);
  }, [storeSearch]);

  useEffect(() => {
    setMaterialPage(1);
  }, [materialSearch, sourceStoreId]);

  useEffect(() => {
    if (storePage > totalStorePages) {
      setStorePage(totalStorePages);
    }
  }, [storePage, totalStorePages]);

  useEffect(() => {
    if (materialPage > totalMaterialPages) {
      setMaterialPage(totalMaterialPages);
    }
  }, [materialPage, totalMaterialPages]);

  const loading =
    itemsLoading ||
    storesLoading ||
    latestPricesQuery.isLoading ||
    quoteDetail.isLoading ||
    (Boolean(sourceStoreId) && storePricesQuery.isLoading);

  const combinedError = itemsError
    ? new Error(itemsError.message)
    : storesError
      ? new Error(storesError.message)
      : latestPricesQuery.error
        ? new Error(latestPricesQuery.error.message)
        : quoteDetail.error
          ? new Error(quoteDetail.error.message)
          : storePricesQuery.error
            ? new Error(storePricesQuery.error.message)
            : null;

  const selectCatalogItem = (itemId: string) => {
    const item = materialItems.find((entry) => entry.id === itemId);
    if (!item) return;

    setValue('item_id', item.id, { shouldValidate: true });
    setValue('unit', item.unit ?? '', { shouldValidate: true });
    setValue('unit_price', getListPrice(item.id), { shouldValidate: true });
  };

  const syncCurrentPriceToStore = async () => {
    try {
      if (!sourceStoreId) {
        throw new Error('Selecciona una tienda antes de actualizar el precio.');
      }

      if (entryMode !== 'catalog' || !selectedItemId) {
        throw new Error('Selecciona un material de la lista antes de actualizar el precio.');
      }

      const parsedPrice = Number(getValues('unit_price'));
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        throw new Error('Ingresa un costo unitario valido antes de actualizar el precio.');
      }

      await createPrice.mutateAsync({
        store_id: sourceStoreId,
        item_id: selectedItemId,
        price: parsedPrice,
        currency: 'ARS',
        observed_at: new Date().toISOString(),
        source_type: 'quote',
        quantity_reference: String(getValues('quantity')),
        notes: null,
      });

      setSnack('Precio de tienda actualizado.');
    } catch (error) {
      setSnack(toUserErrorMessage(error, 'No se pudo actualizar el precio de la tienda.'));
    }
  };

  const submit = async () => {
    try {
      if (entryMode === 'catalog' && !sourceStoreId) {
        throw new Error('Selecciona una tienda para cargar desde lista.');
      }

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

      setValue('margin_percent', null, { shouldValidate: true });

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
        margin_percent: null,
        source_store_id: entryMode === 'catalog' ? values.source_store_id ?? null : null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      });

      toast.success('Material agregado.');
      router.back();
    } catch (error) {
      setSnack(toUserErrorMessage(error, 'No se pudo agregar el material.'));
    }
  };

  return (
    <AppScreen title="Agregar material al trabajo">
      <LoadingOrError isLoading={loading} error={combinedError} />

      <View style={styles.page}>
        <View style={styles.modeBlock}>
          <Text variant="titleMedium">Modo de carga</Text>
          <SegmentedButtons
            value={entryMode}
            onValueChange={(value) => {
              const nextMode = value as MaterialEntryMode;
              setEntryMode(nextMode);
              setValue('item_id', '', { shouldValidate: true });
              setValue('unit', '', { shouldValidate: true });
              setValue('unit_price', 0, { shouldValidate: true });
              setMaterialSearch('');
            }}
            buttons={[
              { value: 'catalog', label: 'Desde lista' },
              { value: 'manual', label: 'Manual' },
            ]}
          />
        </View>

        <Card mode="outlined" style={styles.tableCard}>
          <Card.Content style={styles.tableContent}>
            <View style={styles.tableHeaderBlock}>
              <Text variant="titleSmall">Tienda de compra</Text>
              <Text style={styles.helperText}>Selecciona la tienda desde la que queres cargar materiales.</Text>
            </View>

            <Searchbar placeholder="Buscar tienda" value={storeSearch} onChangeText={setStoreSearch} style={styles.searchbar} />

            <View style={styles.tableShell}>
              <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScrollContent}>
                <View style={styles.storeTableFrame}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.headerCell, styles.storeNameColumn]}>Tienda</Text>
                    <Text style={[styles.headerCell, styles.storeMetaColumn]}>Detalle</Text>
                  </View>

                  {paginatedStores.length > 0 ? (
                    paginatedStores.map((item, index) => {
                      const selected = sourceStoreId === item.id;

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setValue('source_store_id', item.id, { shouldValidate: true })}
                          style={[
                            styles.tableRow,
                            index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                            selected && styles.tableRowSelectedBlue,
                          ]}
                        >
                          <Text style={[styles.rowCell, styles.storeNameColumn, styles.primaryRowValue]}>{item.name}</Text>
                          <Text style={[styles.rowCell, styles.storeMetaColumn]}>
                            {item.description?.trim() || item.address?.trim() || 'Sin detalle'}
                          </Text>
                        </Pressable>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyStateText}>No hay tiendas que coincidan con la busqueda.</Text>
                  )}
                </View>
              </ScrollView>
            </View>

            <View style={styles.paginationBar}>
              <Text style={styles.paginationText}>
                {filteredStores.length > 0 ? `Mostrando ${(storePage - 1) * PAGE_SIZE + 1}-${Math.min(storePage * PAGE_SIZE, filteredStores.length)} de ${filteredStores.length}` : 'Sin resultados'}
              </Text>
              <View style={styles.paginationActions}>
                <IconButton
                  icon="arrow-left"
                  mode="outlined"
                  size={18}
                  accessibilityLabel="Pagina anterior de tiendas"
                  onPress={() => setStorePage((current) => Math.max(1, current - 1))}
                  disabled={storePage === 1}
                  style={styles.paginationIcon}
                />
                <Text style={styles.paginationText}>
                  {storePage}/{totalStorePages}
                </Text>
                <IconButton
                  icon="arrow-right"
                  mode="outlined"
                  size={18}
                  accessibilityLabel="Pagina siguiente de tiendas"
                  onPress={() => setStorePage((current) => Math.min(totalStorePages, current + 1))}
                  disabled={storePage === totalStorePages}
                  style={styles.paginationIcon}
                />
              </View>
            </View>
          </Card.Content>
        </Card>

        {entryMode === 'catalog' ? (
          <Card mode="outlined" style={styles.tableCard}>
            <Card.Content style={styles.tableContent}>
              <View style={styles.tableHeaderBlock}>
                <Text variant="titleSmall">Materiales</Text>
                <Text style={styles.helperText}>El precio visible en la lista se usa como base para este trabajo.</Text>
              </View>

              <Searchbar
                placeholder={sourceStoreId ? 'Buscar material de la tienda' : 'Buscar material'}
                value={materialSearch}
                onChangeText={setMaterialSearch}
                style={styles.searchbar}
              />

              <View style={styles.tableShell}>
                <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScrollContent}>
                  <View style={styles.materialTableFrame}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.headerCell, styles.materialNameColumn]}>Material</Text>
                      <Text style={[styles.headerCell, styles.materialCategoryColumn]}>Categoria</Text>
                      <Text style={[styles.headerCell, styles.materialPriceColumn]}>Precio</Text>
                    </View>

                    {!sourceStoreId ? (
                      <Text style={styles.emptyStateText}>Selecciona una tienda para ver materiales de lista.</Text>
                    ) : paginatedMaterials.length > 0 ? (
                      paginatedMaterials.map((item, index) => {
                        const selected = selectedItemId === item.id;
                        const rowPrice = getListPrice(item.id);

                        return (
                          <Pressable
                            key={item.id}
                            onPress={() => selectCatalogItem(item.id)}
                            style={[
                              styles.tableRow,
                              index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                              selected && styles.tableRowSelectedGreen,
                            ]}
                          >
                            <View style={styles.materialNameColumn}>
                              <Text style={[styles.rowCell, styles.primaryRowValue]} numberOfLines={2}>
                                {item.name}
                              </Text>
                              <Text style={styles.rowMeta}>{item.brand ?? 'Sin marca'}</Text>
                            </View>
                            <Text style={[styles.rowCell, styles.materialCategoryColumn]} numberOfLines={2}>
                              {item.category ?? 'Sin categoria'}
                            </Text>
                            <Text style={[styles.rowCell, styles.materialPriceColumn, styles.priceValue]}>
                              {rowPrice > 0 ? formatCurrencyArs(rowPrice) : 'Sin precio'}
                            </Text>
                          </Pressable>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyStateText}>No hay materiales que coincidan con la busqueda.</Text>
                    )}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.paginationBar}>
                <Text style={styles.paginationText}>
                  {sourceStoreId && filteredItems.length > 0
                    ? `Mostrando ${(materialPage - 1) * PAGE_SIZE + 1}-${Math.min(materialPage * PAGE_SIZE, filteredItems.length)} de ${filteredItems.length}`
                    : sourceStoreId
                      ? 'Sin resultados'
                      : 'Selecciona una tienda'}
                </Text>
                <View style={styles.paginationActions}>
                  <IconButton
                    icon="arrow-left"
                    mode="outlined"
                    size={18}
                    accessibilityLabel="Pagina anterior de materiales"
                    onPress={() => setMaterialPage((current) => Math.max(1, current - 1))}
                    disabled={materialPage === 1 || !sourceStoreId}
                    style={styles.paginationIcon}
                  />
                  <Text style={styles.paginationText}>
                    {materialPage}/{totalMaterialPages}
                  </Text>
                  <IconButton
                    icon="arrow-right"
                    mode="outlined"
                    size={18}
                    accessibilityLabel="Pagina siguiente de materiales"
                    onPress={() => setMaterialPage((current) => Math.min(totalMaterialPages, current + 1))}
                    disabled={materialPage === totalMaterialPages || !sourceStoreId}
                    style={styles.paginationIcon}
                  />
                </View>
              </View>
            </Card.Content>
          </Card>
        ) : (
          <Card mode="outlined" style={styles.tableCard}>
            <Card.Content style={styles.formBlock}>
              <Text variant="titleSmall">Material manual</Text>
              <TextInput mode="outlined" label="Nombre del material" value={manualName} onChangeText={setManualName} outlineStyle={styles.inputOutline} />
              <TextInput mode="outlined" label="Categoria (opcional)" value={manualCategory} onChangeText={setManualCategory} outlineStyle={styles.inputOutline} />
              <TextInput mode="outlined" label="Unidad (opcional)" value={manualUnit} onChangeText={setManualUnit} outlineStyle={styles.inputOutline} />
              <TextInput mode="outlined" label="Marca (opcional)" value={manualBrand} onChangeText={setManualBrand} outlineStyle={styles.inputOutline} />
            </Card.Content>
          </Card>
        )}

        <Card mode="outlined" style={styles.tableCard}>
          <Card.Content style={styles.formBlock}>
            <Text variant="titleSmall">Detalles</Text>
            {entryMode === 'catalog' && selectedItem ? (
              <Text style={styles.helperText}>Material seleccionado: {selectedItem.name}</Text>
            ) : null}

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

            {entryMode === 'manual' ? (
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <TextInput mode="outlined" label="Unidad (opcional)" value={field.value ?? ''} onChangeText={field.onChange} outlineStyle={styles.inputOutline} />
                )}
              />
            ) : null}

            <Controller
              control={control}
              name="unit_price"
              render={({ field }) => (
                <TextInput
                  mode="outlined"
                  label="Costo unitario"
                  keyboardType="decimal-pad"
                  value={field.value === 0 ? '' : String(field.value)}
                  onChangeText={field.onChange}
                  outlineStyle={styles.inputOutline}
                />
              )}
            />

            {entryMode === 'catalog' && sourceStoreId && selectedItemId ? (
              <Button
                mode="outlined"
                icon="store-cog-outline"
                onPress={syncCurrentPriceToStore}
                loading={createPrice.isPending}
                disabled={createPrice.isPending || Number(unitPrice) <= 0}
                style={styles.secondaryActionButton}
                contentStyle={styles.secondaryActionButtonContent}
              >
                Actualizar precio en tienda
              </Button>
            ) : null}

            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <TextInput
                  mode="outlined"
                  label="Notas"
                  value={field.value ?? ''}
                  onChangeText={field.onChange}
                  multiline
                  numberOfLines={3}
                  outlineStyle={styles.inputOutline}
                />
              )}
            />
          </Card.Content>
        </Card>

        <View style={styles.summaryCard}>
          <Text variant="titleSmall" style={styles.summaryTitle}>
            Resumen estimado
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Costo unitario</Text>
            <Text style={styles.summaryValue}>{formatCurrencyArs(Number(unitPrice) || 0)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Venta unitaria estimada</Text>
            <Text style={styles.summaryValue}>{formatCurrencyArs(effectiveUnitPrice)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowTotal]}>
            <Text style={styles.summaryTotalLabel}>Total estimado</Text>
            <Text style={styles.summaryTotalValue}>{formatCurrencyArs(effectiveTotal)}</Text>
          </View>
        </View>

        <Button mode="contained" loading={add.isPending || saveItem.isPending} onPress={submit} style={styles.submitButton} contentStyle={styles.submitButtonContent}>
          Agregar material al trabajo
        </Button>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    gap: 14,
  },
  modeBlock: {
    gap: 10,
  },
  tableCard: {
    borderRadius: 12,
  },
  tableContent: {
    gap: 10,
    paddingVertical: 8,
  },
  formBlock: {
    gap: 12,
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
  searchbar: {
    borderRadius: 10,
  },
  tableShell: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableScrollContent: {
    paddingBottom: 2,
  },
  storeTableFrame: {
    minWidth: 382,
    gap: 8,
  },
  materialTableFrame: {
    minWidth: 470,
    gap: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_BLUE_SOFT,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerCell: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: BRAND_BLUE,
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
  tableRowSelectedBlue: {
    borderColor: BRAND_BLUE,
    backgroundColor: BRAND_BLUE_SOFT,
  },
  tableRowSelectedGreen: {
    borderColor: BRAND_GREEN,
    backgroundColor: BRAND_GREEN_SOFT,
  },
  rowCell: {
    fontSize: 13,
    lineHeight: 18,
  },
  primaryRowValue: {
    fontWeight: '500',
    color: '#101828',
  },
  rowMeta: {
    fontSize: 12,
    lineHeight: 16,
    color: '#5f6368',
  },
  storeNameColumn: {
    width: 150,
    paddingRight: 10,
  },
  storeMetaColumn: {
    width: 200,
  },
  materialNameColumn: {
    width: 220,
    paddingRight: 12,
  },
  materialCategoryColumn: {
    width: 130,
    paddingRight: 12,
  },
  materialPriceColumn: {
    width: 122,
  },
  priceValue: {
    fontWeight: '600',
  },
  emptyStateText: {
    paddingVertical: 18,
    textAlign: 'center',
    color: '#5f6368',
  },
  inputOutline: {
    borderRadius: 10,
  },
  secondaryActionButton: {
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  secondaryActionButtonContent: {
    minHeight: 40,
    paddingHorizontal: 8,
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  paginationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paginationIcon: {
    margin: 0,
  },
  paginationText: {
    color: '#5f6368',
    fontSize: 12,
    lineHeight: 18,
  },
  summaryCard: {
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C9DDB7',
    backgroundColor: BRAND_GREEN_SOFT,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  summaryTitle: {
    color: BRAND_GREEN,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: {
    color: '#4F5E73',
    flex: 1,
  },
  summaryValue: {
    color: '#253245',
    fontWeight: '600',
    textAlign: 'right',
  },
  summaryRowTotal: {
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#C9DDB7',
  },
  summaryTotalLabel: {
    color: '#254929',
    fontWeight: '700',
    flex: 1,
  },
  summaryTotalValue: {
    color: '#17351D',
    fontWeight: '800',
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'right',
  },
  submitButton: {
    borderRadius: 10,
  },
  submitButtonContent: {
    minHeight: 44,
  },
});
