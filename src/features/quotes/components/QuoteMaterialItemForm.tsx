import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Menu, Searchbar, Text, TextInput } from 'react-native-paper';

import type { Item, LatestStoreItemPrice, Store } from '@/types/db';
import { formatCurrencyArs, formatPercent } from '@/lib/format';
import { formatItemDisplayName, formatItemPresentation } from '@/lib/itemDisplay';
import { BRAND_BLUE, BRAND_BLUE_SOFT, BRAND_GREEN, BRAND_GREEN_MID, BRAND_GREEN_SOFT } from '@/theme';

import { QuoteMaterialItemFormValues, quoteMaterialItemSchema } from '../schemas';
import { getEffectiveMaterialMarginPercent, getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from '../materialPricing';

interface Props {
  stores: Store[];
  items: Item[];
  latestPrices: LatestStoreItemPrice[];
  isCatalogLoading?: boolean;
  defaultValues: QuoteMaterialItemFormValues;
  onSubmit: (values: QuoteMaterialItemFormValues) => Promise<void>;
  submitLabel: string;
  defaultMarginPercent?: number | null;
}

export const QuoteMaterialItemForm = ({
  stores,
  items,
  latestPrices,
  isCatalogLoading = false,
  defaultValues,
  onSubmit,
  submitLabel,
  defaultMarginPercent = null,
}: Props) => {
  const { control, handleSubmit, watch, setValue, getValues } = useForm<QuoteMaterialItemFormValues>({
    resolver: zodResolver(quoteMaterialItemSchema),
    defaultValues,
  });
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);
  const [materialSearch, setMaterialSearch] = useState('');
  const [seededSearch, setSeededSearch] = useState(false);

  const sourceStoreId = watch('source_store_id');
  const selectedItemId = watch('item_id');
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');
  const marginPercent = watch('margin_percent');

  const storePriceRows = useMemo(
    () => (sourceStoreId ? latestPrices.filter((row) => row.store_id === sourceStoreId) : []),
    [latestPrices, sourceStoreId],
  );
  const storeItemIds = useMemo(() => new Set(storePriceRows.map((row) => row.item_id)), [storePriceRows]);
  const storePriceByItemId = useMemo(() => new Map(storePriceRows.map((row) => [row.item_id, row.price] as const)), [storePriceRows]);
  const latestPriceByItemId = useMemo(() => {
    const map = new Map<string, number>();
    latestPrices.forEach((row) => {
      if (!map.has(row.item_id)) {
        map.set(row.item_id, row.price);
      }
    });
    return map;
  }, [latestPrices]);

  const materialItems = useMemo(() => items.filter((item) => item.item_type === 'material'), [items]);
  const catalogItems = useMemo(
    () => (sourceStoreId ? materialItems.filter((item) => storeItemIds.has(item.id)) : materialItems),
    [materialItems, sourceStoreId, storeItemIds],
  );

  const filteredItems = useMemo(() => {
    const query = materialSearch.trim().toLowerCase();
    if (!query) {
      return catalogItems.slice(0, 8);
    }

    return catalogItems
      .filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.category ?? '').toLowerCase().includes(query) ||
          (item.variant_label ?? '').toLowerCase().includes(query) ||
          (item.presentation_unit ?? '').toLowerCase().includes(query) ||
          formatItemPresentation(item)?.toLowerCase().includes(query) === true,
      )
      .slice(0, 12);
  }, [catalogItems, materialSearch]);

  const selectedItem =
    catalogItems.find((item) => item.id === selectedItemId) ??
    materialItems.find((item) => item.id === selectedItemId) ??
    null;
  const selectedBaseCost = useMemo(() => {
    if (!selectedItemId) return 0;
    if (sourceStoreId) {
      return Number(storePriceByItemId.get(selectedItemId) ?? 0);
    }
    return Number(latestPriceByItemId.get(selectedItemId) ?? 0);
  }, [latestPriceByItemId, selectedItemId, sourceStoreId, storePriceByItemId]);

  const selectedStoreLabel = useMemo(() => {
    if (!sourceStoreId) {
      return 'Sin tienda';
    }

    return stores.find((store) => store.id === sourceStoreId)?.name ?? 'Tienda seleccionada';
  }, [sourceStoreId, stores]);

  const effectiveMargin = getEffectiveMaterialMarginPercent(marginPercent, defaultMarginPercent);
  const effectiveUnitPrice = getMaterialEffectiveUnitPrice(unitPrice, marginPercent, defaultMarginPercent);
  const effectiveTotal = getMaterialEffectiveTotalPrice(quantity, unitPrice, marginPercent, defaultMarginPercent);
  const searchMatchesSelected =
    selectedItem != null && materialSearch.trim().toLowerCase() === formatItemDisplayName(selectedItem).trim().toLowerCase();
  const shouldShowResults = !selectedItem || !searchMatchesSelected;

  useEffect(() => {
    if (!sourceStoreId || !selectedItemId) return;
    if (storeItemIds.has(selectedItemId)) return;

    setValue('item_id', '', { shouldValidate: true });
    setValue('unit', '', { shouldValidate: true });
    setValue('unit_price', 0, { shouldValidate: true });
    setMaterialSearch('');
    setSeededSearch(false);
  }, [selectedItemId, setValue, sourceStoreId, storeItemIds]);

  useEffect(() => {
    if (!selectedItem) return;

    const currentUnit = getValues('unit') ?? '';
    const nextUnit = selectedItem.unit ?? '';
    if (currentUnit !== nextUnit) {
      setValue('unit', nextUnit, { shouldValidate: true });
    }

    if (!seededSearch) {
      setMaterialSearch(formatItemDisplayName(selectedItem));
      setSeededSearch(true);
    }
  }, [getValues, seededSearch, selectedItem, setValue]);

  useEffect(() => {
    if (!selectedItemId) return;
    const nextCost = selectedBaseCost;
    if (Number(getValues('unit_price')) !== nextCost) {
      setValue('unit_price', nextCost, { shouldValidate: true });
    }
  }, [getValues, selectedBaseCost, selectedItemId, setValue]);

  const selectMaterial = (item: Item) => {
    setValue('item_id', item.id, { shouldValidate: true });
    setValue('unit', item.unit ?? '', { shouldValidate: true });
    if (sourceStoreId) {
      setValue('unit_price', Number(storePriceByItemId.get(item.id) ?? 0), { shouldValidate: true });
    }
    setMaterialSearch(formatItemDisplayName(item));
    setSeededSearch(true);
  };

  return (
    <View style={styles.form}>
      <View style={styles.fieldBlock}>
        <Text variant="labelMedium" style={styles.fieldLabel}>
          Tienda de referencia
        </Text>
        <Menu
          visible={storeMenuVisible}
          onDismiss={() => setStoreMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              icon="storefront-outline"
              onPress={() => setStoreMenuVisible(true)}
              style={styles.selectButton}
              contentStyle={styles.selectButtonContent}
            >
              {selectedStoreLabel}
            </Button>
          }
        >
          <Menu.Item
            title="Sin tienda"
            onPress={() => {
              setValue('source_store_id', null, { shouldValidate: true });
              setStoreMenuVisible(false);
            }}
          />
          {stores.map((store) => (
            <Menu.Item
              key={store.id}
              title={store.name}
              onPress={() => {
                setValue('source_store_id', store.id, { shouldValidate: true });
                setStoreMenuVisible(false);
              }}
            />
          ))}
        </Menu>
        <Text style={styles.helperText}>
          {sourceStoreId ? 'El catálogo se filtra por materiales con precio en esa tienda.' : 'Sin tienda, se usa el catálogo general.'}
        </Text>
      </View>

      <View style={styles.fieldBlock}>
        <Text variant="labelMedium" style={styles.fieldLabel}>
          Material
        </Text>
        <Searchbar
          placeholder={sourceStoreId ? 'Buscar material de la tienda' : 'Buscar material'}
          value={materialSearch}
          onChangeText={setMaterialSearch}
          onClearIconPress={() => setMaterialSearch('')}
          style={styles.searchbar}
        />

        {selectedItem ? (
          <Card mode="outlined" style={styles.selectedItemCard}>
            <Card.Content style={styles.selectedItemContent}>
              <Text variant="titleSmall" style={styles.selectedItemTitle}>
                {formatItemDisplayName(selectedItem)}
              </Text>
              <View style={styles.selectedItemTagsRow}>
                <View style={styles.selectedItemBadge}>
                  <Text variant="labelSmall" style={styles.selectedItemBadgeText}>
                    {sourceStoreId ? 'Catalogo tienda' : 'Catalogo general'}
                  </Text>
                </View>
                {selectedItem.category ? (
                  <View style={styles.selectedItemMetaChip}>
                    <Text variant="labelSmall" style={styles.selectedItemMetaChipText}>
                      {selectedItem.category}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.selectedItemMeta}>
                {[formatItemPresentation(selectedItem) ?? selectedItem.unit ?? 'Sin unidad'].filter(Boolean).join(' · ')}
              </Text>
              <View style={styles.selectedItemPriceRow}>
                <Text style={styles.selectedItemPriceLabel}>Costo precargado</Text>
                <Text style={styles.selectedItemPrice}>{formatCurrencyArs(selectedBaseCost)}</Text>
              </View>
            </Card.Content>
          </Card>
        ) : null}

        {shouldShowResults ? (
          <View style={styles.resultsPanel}>
            {isCatalogLoading ? (
              <Text style={styles.helperText}>Cargando catalogo...</Text>
            ) : filteredItems.length > 0 ? (
              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                style={styles.resultsList}
                renderItem={({ item }) => {
                  const selected = item.id === selectedItemId;

                  return (
                    <Card mode="outlined" style={[styles.resultCard, selected && styles.resultCardSelected]} onPress={() => selectMaterial(item)}>
                      <Card.Content style={styles.resultCardContent}>
                        <Text variant="titleSmall" style={styles.resultTitle}>
                          {formatItemDisplayName(item)}
                        </Text>
                        <Text style={styles.resultMeta}>
                          {[item.category ?? 'Sin categoria', formatItemPresentation(item)].filter(Boolean).join(' · ')}
                        </Text>
                        <Text style={styles.resultPrice}>
                          {sourceStoreId && storePriceByItemId.has(item.id)
                            ? `Precio en tienda: ${formatCurrencyArs(Number(storePriceByItemId.get(item.id) ?? 0))}`
                            : `Ultimo precio: ${formatCurrencyArs(Number(latestPriceByItemId.get(item.id) ?? 0))}`}
                        </Text>
                      </Card.Content>
                    </Card>
                  );
                }}
              />
            ) : (
              <Text style={styles.helperText}>
                {sourceStoreId ? 'No hay materiales con precio cargado en esta tienda.' : 'No hay materiales que coincidan con la busqueda.'}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      <Controller
        control={control}
        name="unit_price"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Costo unitario"
            value={field.value === 0 ? '' : String(field.value)}
            editable={false}
            disabled={!selectedItemId}
            outlineStyle={styles.inputOutline}
          />
        )}
      />
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
        name="margin_percent"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Margen % (vacio = global)"
            keyboardType="decimal-pad"
            value={field.value == null ? '' : String(field.value)}
            onChangeText={(value) => field.onChange(value ? Number(value) : null)}
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
            multiline
            numberOfLines={3}
            outlineStyle={styles.inputOutline}
          />
        )}
      />

      <View style={styles.summaryCard}>
        <Text variant="titleSmall" style={styles.summaryTitle}>
          Resumen estimado
        </Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Margen efectivo</Text>
          <Text style={styles.summaryValue}>{formatPercent(effectiveMargin)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Venta unitaria</Text>
          <Text style={styles.summaryValue}>{formatCurrencyArs(effectiveUnitPrice)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.summaryRowTotal]}>
          <Text style={styles.summaryTotalLabel}>Total estimado</Text>
          <Text style={styles.summaryTotalValue}>{formatCurrencyArs(effectiveTotal)}</Text>
        </View>
      </View>

      <Button mode="contained" onPress={handleSubmit(onSubmit)} style={styles.submitButton} contentStyle={styles.submitButtonContent}>
        {submitLabel}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 12,
    paddingTop: 4,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    color: '#495461',
  },
  inputOutline: {
    borderRadius: 12,
  },
  searchbar: {
    borderRadius: 12,
  },
  selectButton: {
    borderRadius: 12,
    alignItems: 'flex-start',
    borderColor: '#C9D7E6',
  },
  selectButtonContent: {
    minHeight: 48,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  helperText: {
    color: '#6A7280',
    fontSize: 12,
    lineHeight: 17,
  },
  selectedItemCard: {
    borderRadius: 14,
    borderColor: '#D3E1EF',
    backgroundColor: BRAND_BLUE_SOFT,
  },
  selectedItemContent: {
    gap: 8,
    paddingVertical: 12,
  },
  selectedItemTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  selectedItemTitle: {
    fontWeight: '700',
    lineHeight: 22,
  },
  selectedItemBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#D8E4F2',
  },
  selectedItemBadgeText: {
    color: BRAND_BLUE,
    fontWeight: '700',
  },
  selectedItemMetaChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#EEF3F8',
  },
  selectedItemMetaChipText: {
    color: '#5C6B7A',
    fontWeight: '600',
  },
  selectedItemMeta: {
    color: '#51606E',
    fontSize: 12,
    lineHeight: 17,
  },
  selectedItemPriceRow: {
    gap: 2,
  },
  selectedItemPriceLabel: {
    color: '#5D6C7A',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  selectedItemPrice: {
    color: BRAND_BLUE,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  resultsPanel: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DCE4EC',
    backgroundColor: '#FAFCFE',
    padding: 8,
  },
  resultsList: {
    maxHeight: 220,
  },
  resultCard: {
    marginBottom: 8,
    borderRadius: 12,
    borderColor: '#DCE4EC',
  },
  resultCardSelected: {
    borderColor: BRAND_BLUE,
    backgroundColor: BRAND_BLUE_SOFT,
  },
  resultCardContent: {
    gap: 2,
    paddingVertical: 10,
  },
  resultTitle: {
    fontWeight: '600',
  },
  resultMeta: {
    color: '#5C6773',
    fontSize: 12,
    lineHeight: 16,
  },
  resultPrice: {
    color: '#405162',
    fontSize: 12,
    lineHeight: 16,
  },
  summaryCard: {
    gap: 10,
    marginTop: 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_GREEN_MID,
    backgroundColor: BRAND_GREEN_SOFT,
  },
  summaryTitle: {
    fontWeight: '700',
    color: BRAND_GREEN,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryRowTotal: {
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#D2DEC9',
  },
  summaryLabel: {
    color: '#53606D',
    fontSize: 13,
    lineHeight: 18,
  },
  summaryValue: {
    color: '#263340',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  summaryTotalLabel: {
    color: BRAND_GREEN,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  summaryTotalValue: {
    color: '#17341C',
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  submitButton: {
    marginTop: 2,
    borderRadius: 999,
    backgroundColor: BRAND_BLUE,
  },
  submitButtonContent: {
    minHeight: 48,
  },
});
