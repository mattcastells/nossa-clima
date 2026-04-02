import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SummaryRow } from '@/features/quotes/components/QuoteItemsSummary';
import { getMaterialEffectiveTotalPrice } from '@/features/quotes/materialPricing';
import { useItemMeasurements } from '@/features/items/hooks';
import { useLatestMeasurePrices } from '@/features/prices/hooks';
import { formatItemDisplayName, formatMeasuredItemDisplayName } from '@/lib/itemDisplay';
import type { Item, ItemMeasurement, LatestStoreItemPrice, Store } from '@/types/db';

import { parseNonNegativeInput, parsePositiveInput } from './parseInput';
import { createDraftId, type DraftMaterialLine } from './types';

interface UseMaterialDraftOptions {
  items: Item[] | undefined;
  stores: Store[] | undefined;
  latestPricesData: LatestStoreItemPrice[] | undefined;
  onError: (msg: string) => void;
}

export function useMaterialDraft({ items, stores, latestPricesData, onError }: UseMaterialDraftOptions) {
  const [storeSearch, setStoreSearch] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [materialQuantityInput, setMaterialQuantityInput] = useState('1');
  const [materialUnitPriceInput, setMaterialUnitPriceInput] = useState('');
  const [materialNotesInput, setMaterialNotesInput] = useState('');
  const [draftMaterials, setDraftMaterials] = useState<DraftMaterialLine[]>([]);

  const latestMeasurePricesQuery = useLatestMeasurePrices(
    selectedStoreId ? { storeId: selectedStoreId } : {},
  );
  const {
    data: measurementsData,
    isLoading: measurementsLoading,
    error: measurementsError,
  } = useItemMeasurements(selectedItemId);

  const itemMeasurements: ItemMeasurement[] = measurementsData ?? [];

  const materialItems = useMemo(
    () =>
      (items ?? [])
        .filter((item) => item.item_type === 'material')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  const selectedStore = useMemo(
    () => (stores ?? []).find((s) => s.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );
  const selectedItem = useMemo(
    () => materialItems.find((item) => item.id === selectedItemId) ?? null,
    [materialItems, selectedItemId],
  );
  const selectedMeasurement = useMemo(
    () => itemMeasurements.find((m) => m.id === selectedMeasurementId) ?? null,
    [itemMeasurements, selectedMeasurementId],
  );
  const hasMeasurements = itemMeasurements.length > 0;

  const storeBaseRows = useMemo(
    () => (latestPricesData ?? []).filter((row) => row.store_id === selectedStoreId),
    [latestPricesData, selectedStoreId],
  );
  const storeMeasureRows = useMemo(
    () =>
      selectedStoreId
        ? (latestMeasurePricesQuery.data ?? []).filter((row) => row.store_id === selectedStoreId)
        : [],
    [latestMeasurePricesQuery.data, selectedStoreId],
  );
  const directPriceByItemId = useMemo(
    () => new Map(storeBaseRows.map((row) => [row.item_id, Number(row.price)] as const)),
    [storeBaseRows],
  );
  const measurePriceByMeasurementId = useMemo(
    () => new Map(storeMeasureRows.map((row) => [row.item_measurement_id, Number(row.price)] as const)),
    [storeMeasureRows],
  );
  const measuredItemIds = useMemo(() => new Set(storeMeasureRows.map((row) => row.item_id)), [storeMeasureRows]);
  const directItemIds = useMemo(() => new Set(storeBaseRows.map((row) => row.item_id)), [storeBaseRows]);

  const filteredStores = useMemo(() => {
    const query = storeSearch.trim().toLowerCase();
    return (stores ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(
        (s) =>
          !query ||
          s.name.toLowerCase().includes(query) ||
          (s.address ?? '').toLowerCase().includes(query) ||
          (s.description ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [storeSearch, stores]);

  const filteredItems = useMemo(() => {
    if (!selectedStoreId) return [];
    const query = materialSearch.trim().toLowerCase();
    return materialItems
      .filter((item) => directItemIds.has(item.id) || measuredItemIds.has(item.id))
      .filter(
        (item) =>
          !query ||
          item.name.toLowerCase().includes(query) ||
          (item.category ?? '').toLowerCase().includes(query) ||
          (item.base_price_label ?? '').toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [directItemIds, materialItems, materialSearch, measuredItemIds, selectedStoreId]);

  const previewTotal = useMemo(() => {
    const quantity = parsePositiveInput(materialQuantityInput) ?? 0;
    const unitPrice = parseNonNegativeInput(materialUnitPriceInput) ?? 0;
    return getMaterialEffectiveTotalPrice(quantity, unitPrice, null, null);
  }, [materialQuantityInput, materialUnitPriceInput]);

  const summaryRows: SummaryRow[] = useMemo(
    () =>
      draftMaterials.map((m) => ({
        id: m.id,
        label: m.source_store_name ? `${m.label} - ${m.source_store_name}` : m.label,
        quantityLabel: `${m.quantity}${m.unit ? ` ${m.unit}` : ''}`,
        unitPrice: m.unit_price,
        totalPrice: m.total_price,
      })),
    [draftMaterials],
  );

  // Reset all material inputs when the store changes.
  useEffect(() => {
    setSelectedItemId('');
    setSelectedMeasurementId(null);
    setMaterialSearch('');
    setMaterialQuantityInput('1');
    setMaterialUnitPriceInput('');
    setMaterialNotesInput('');
  }, [selectedStoreId]);

  // Auto-select the best measurement when the selected item or its measurements change.
  useEffect(() => {
    if (!selectedItem) {
      setSelectedMeasurementId(null);
      setMaterialUnitPriceInput('');
      return;
    }

    if (itemMeasurements.length === 0) {
      setSelectedMeasurementId(null);
      const directPrice = directPriceByItemId.get(selectedItem.id);
      setMaterialUnitPriceInput(directPrice != null ? String(directPrice) : '');
      return;
    }

    const nextMeasurement =
      itemMeasurements.find((m) => m.id === selectedMeasurementId) ??
      itemMeasurements.find((m) => measurePriceByMeasurementId.has(m.id)) ??
      itemMeasurements[0] ??
      null;

    if (!nextMeasurement) {
      setSelectedMeasurementId(null);
      setMaterialUnitPriceInput('');
      return;
    }

    if (nextMeasurement.id !== selectedMeasurementId) {
      setSelectedMeasurementId(nextMeasurement.id);
    }
  }, [directPriceByItemId, itemMeasurements, measurePriceByMeasurementId, selectedItem, selectedMeasurementId]);

  // Sync price when the selected measurement changes (including user-driven changes).
  useEffect(() => {
    if (!selectedItem) return;

    if (!selectedMeasurement) {
      if (itemMeasurements.length === 0) {
        const directPrice = directPriceByItemId.get(selectedItem.id);
        setMaterialUnitPriceInput(directPrice != null ? String(directPrice) : '');
      }
      return;
    }

    const measurementPrice = measurePriceByMeasurementId.get(selectedMeasurement.id);
    setMaterialUnitPriceInput(measurementPrice != null ? String(measurementPrice) : '');
  }, [directPriceByItemId, itemMeasurements.length, measurePriceByMeasurementId, selectedItem, selectedMeasurement]);

  const resetInputs = useCallback(() => {
    setSelectedItemId('');
    setSelectedMeasurementId(null);
    setMaterialSearch('');
    setMaterialQuantityInput('1');
    setMaterialUnitPriceInput('');
    setMaterialNotesInput('');
  }, []);

  const addDraftMaterial = useCallback(() => {
    const quantity = parsePositiveInput(materialQuantityInput);
    if (!selectedStore || !selectedItem || quantity == null) {
      onError('Selecciona una tienda, un material y una cantidad valida.');
      return;
    }

    if (hasMeasurements && !selectedMeasurement) {
      onError('Selecciona una medida para el material.');
      return;
    }

    const unitPrice = parseNonNegativeInput(materialUnitPriceInput);
    if (unitPrice == null) {
      onError('Ingresa un costo valido para el material.');
      return;
    }

    const label = selectedMeasurement
      ? formatMeasuredItemDisplayName(selectedItem, selectedMeasurement)
      : formatItemDisplayName(selectedItem);
    const unit = selectedMeasurement?.unit ?? selectedItem.unit ?? 'mt';

    setDraftMaterials((current) => [
      ...current,
      {
        id: createDraftId(),
        item_id: selectedItem.id,
        item_measurement_id: selectedMeasurement?.id ?? null,
        label,
        quantity,
        unit,
        unit_price: unitPrice,
        source_store_id: selectedStore.id,
        source_store_name: selectedStore.name,
        notes: materialNotesInput.trim() || null,
        total_price: getMaterialEffectiveTotalPrice(quantity, unitPrice, null, null),
      },
    ]);
    resetInputs();
  }, [
    selectedStore,
    selectedItem,
    selectedMeasurement,
    hasMeasurements,
    materialQuantityInput,
    materialUnitPriceInput,
    materialNotesInput,
    onError,
    resetInputs,
  ]);

  const removeDraftMaterial = useCallback(
    (id: string) => setDraftMaterials((current) => current.filter((m) => m.id !== id)),
    [],
  );

  const selectItem = useCallback((itemId: string) => setSelectedItemId(itemId), []);
  const selectMeasurement = useCallback((measurementId: string) => setSelectedMeasurementId(measurementId), []);
  const clearSelectedItem = useCallback(() => {
    setSelectedItemId('');
    setSelectedMeasurementId(null);
  }, []);

  return {
    // Store state
    storeSearch,
    setStoreSearch,
    selectedStoreId,
    setSelectedStoreId,
    selectedStore,
    filteredStores,
    // Item state
    materialSearch,
    setMaterialSearch,
    selectedItemId,
    selectedItem,
    selectItem,
    clearSelectedItem,
    filteredItems,
    directPriceByItemId,
    measuredItemIds,
    // Measurement state
    selectedMeasurementId,
    selectedMeasurement,
    selectMeasurement,
    itemMeasurements,
    hasMeasurements,
    measurePriceByMeasurementId,
    // Input state
    materialQuantityInput,
    setMaterialQuantityInput,
    materialUnitPriceInput,
    setMaterialUnitPriceInput,
    materialNotesInput,
    setMaterialNotesInput,
    // Draft list
    draftMaterials,
    previewTotal,
    summaryRows,
    // Actions
    addDraftMaterial,
    removeDraftMaterial,
    // Loading / error for catalog data this hook manages internally
    isLoadingExtraData:
      (Boolean(selectedStoreId) && latestMeasurePricesQuery.isLoading) ||
      (Boolean(selectedItemId) && measurementsLoading),
    extraDataError: latestMeasurePricesQuery.error ?? measurementsError ?? null,
  };
}
