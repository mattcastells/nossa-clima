import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import type { QuoteMaterialItem, QuoteServiceItem, Store, QuoteStatus } from '@/types/db';

import { formatCurrencyArs, formatPercent } from '@/lib/format';
import { BRAND_BLUE, BRAND_GREEN, useAppTheme } from '@/theme';

import { getEffectiveMaterialMarginPercent, getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from '../materialPricing';

type EditingTarget = { kind: 'service' | 'material'; id: string } | null;

interface Props {
  quoteId: string;
  services: QuoteServiceItem[];
  materials: QuoteMaterialItem[];
  stores: Store[];
  defaultMarginPercent?: number | null;
  globalMarginInput: string;
  onGlobalMarginChange: (value: string) => void;
  onApplyGlobalMargin: () => Promise<void>;
  onSaveService: (itemId: string, payload: Pick<QuoteServiceItem, 'quantity' | 'unit_price' | 'margin_percent'>) => Promise<void>;
  onDeleteService: (itemId: string) => void;
  onSaveMaterial: (
    itemId: string,
    payload: Partial<Pick<QuoteMaterialItem, 'item_id' | 'quantity' | 'unit' | 'unit_price' | 'margin_percent' | 'source_store_id' | 'notes'>>,
  ) => Promise<void>;
  onDeleteMaterial: (itemId: string) => void;
  quoteStatus?: QuoteStatus;
  isBusy?: boolean;
  isApplyingGlobalMargin?: boolean;
  savingService?: boolean;
  deletingService?: boolean;
  savingMaterial?: boolean;
  deletingMaterial?: boolean;
}

export const QuoteItemsTable = ({
  quoteId,
  services,
  materials,
  stores,
  defaultMarginPercent = null,
  globalMarginInput,
  onGlobalMarginChange,
  onApplyGlobalMargin,
  onSaveService,
  onDeleteService,
  onSaveMaterial,
  onDeleteMaterial,
  quoteStatus,
  isBusy = false,
  isApplyingGlobalMargin = false,
  savingService = false,
  deletingService = false,
  savingMaterial = false,
  deletingMaterial = false,
}: Props) => {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const serviceTint = theme.colors.softBlueStrong;
  const materialTint = theme.colors.softGreenStrong;
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const [serviceQuantityInput, setServiceQuantityInput] = useState('');
  const [servicePriceInput, setServicePriceInput] = useState('');
  const [serviceMarginInput, setServiceMarginInput] = useState('');
  const [materialQuantityInput, setMaterialQuantityInput] = useState('');
  const [materialCostInput, setMaterialCostInput] = useState('');
  const [materialMarginInput, setMaterialMarginInput] = useState('');
  const [materialStoreInput, setMaterialStoreInput] = useState<string | null>(null);
  const [storeSearchText, setStoreSearchText] = useState('');
  const [storeSearchFocused, setStoreSearchFocused] = useState(false);
  const selectedStoreName = materialStoreInput ? stores.find((s) => s.id === materialStoreInput)?.name ?? null : null;
  const filteredStores = useMemo(() => {
    const sorted = [...stores].sort((a, b) => a.name.localeCompare(b.name));
    const q = storeSearchText.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((s) => s.name.toLowerCase().includes(q));
  }, [stores, storeSearchText]);
  const isCompact = width < 520;
  const serviceActionsBusy = isBusy || savingService || deletingService;
  const materialActionsBusy = isBusy || savingMaterial || deletingMaterial;
  const isCompleted = quoteStatus === 'completed';
  const addButtonStyle = StyleSheet.flatten([styles.addButton, isCompact && styles.addButtonCompact]);
  const serviceAddButtonStyle = StyleSheet.flatten([addButtonStyle, styles.serviceAddButton]);
  const materialAddButtonStyle = StyleSheet.flatten([addButtonStyle, styles.materialAddButton]);
  const marginBarStyle = StyleSheet.flatten([styles.marginBar, isCompact && styles.marginBarCompact]);
  const marginLabelStyle = StyleSheet.flatten([styles.marginLabel, isCompact && styles.marginLabelCompact]);
  const marginInputStyle = StyleSheet.flatten([styles.marginInput, isCompact && styles.marginInputCompact]);
  const marginButtonStyle = StyleSheet.flatten([styles.marginButton, isCompact && styles.marginButtonCompact]);

  const editingService = editingTarget?.kind === 'service' ? services.find((item) => item.id === editingTarget.id) ?? null : null;
  const editingMaterial = editingTarget?.kind === 'material' ? materials.find((item) => item.id === editingTarget.id) ?? null : null;

  useEffect(() => {
    if (!editingService) return;
    setServiceQuantityInput(String(editingService.quantity));
    setServicePriceInput(String(editingService.unit_price));
    setServiceMarginInput(editingService.margin_percent == null ? '' : String(editingService.margin_percent));
  }, [editingService]);

  useEffect(() => {
    if (!editingMaterial) return;
    setMaterialQuantityInput(String(editingMaterial.quantity));
    setMaterialCostInput(String(editingMaterial.unit_price));
    setMaterialMarginInput(editingMaterial.margin_percent == null ? '' : String(editingMaterial.margin_percent));
    setMaterialStoreInput(editingMaterial.source_store_id ?? null);
    setStoreSearchText('');
    setStoreSearchFocused(false);
  }, [editingMaterial]);

  const rows = useMemo(
    () => [
      ...services.map((item) => ({
        key: `service-${item.id}`,
        kind: 'service' as const,
        id: item.id,
        label: 'Servicio',
        title: item.service_name_snapshot,
        notes: item.notes,
        quantity: String(item.quantity),
        base: formatCurrencyArs(item.unit_price),
        margin: item.margin_percent != null && item.margin_percent > 0 ? formatPercent(item.margin_percent) : '-',
        saleUnit: formatCurrencyArs(item.unit_price),
        total: formatCurrencyArs(item.total_price),
        source: '-',
      })),
      ...materials.map((item) => {
        const sourceStoreName = item.source_store_id ? stores.find((store) => store.id === item.source_store_id)?.name ?? null : null;
        const effectiveMargin = getEffectiveMaterialMarginPercent(item.margin_percent, defaultMarginPercent);
        const effectiveUnitPrice = getMaterialEffectiveUnitPrice(item.unit_price, item.margin_percent, defaultMarginPercent);
        const effectiveTotalPrice = getMaterialEffectiveTotalPrice(item.quantity, item.unit_price, item.margin_percent, defaultMarginPercent);
        const usesGlobalMargin = item.margin_percent == null && defaultMarginPercent != null;

        return {
          key: `material-${item.id}`,
          kind: 'material' as const,
          id: item.id,
          label: 'Material',
          title: item.item_name_snapshot,
          notes: item.notes,
          quantity: `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`,
          base: formatCurrencyArs(item.unit_price),
          margin: effectiveMargin > 0 ? `${formatPercent(effectiveMargin)}${usesGlobalMargin ? ' global' : ''}` : '-',
          saleUnit: formatCurrencyArs(effectiveUnitPrice),
          total: formatCurrencyArs(effectiveTotalPrice),
          source: sourceStoreName ?? item.source_store_name_snapshot ?? 'Sin tienda',
        };
      }),
    ],
    [defaultMarginPercent, materials, services, stores],
  );

  return (
    <>
      <View style={styles.container}>
        <View style={styles.tableWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.table, { borderColor: theme.colors.borderSoft }]}>
              <View style={[styles.headerRow, { backgroundColor: theme.colors.tableHeaderBg, borderBottomColor: theme.colors.borderSoft }]}>
                <Text style={[styles.hCell, styles.hCellName, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}>
                  Concepto
                </Text>
                <Text style={[styles.hCell, styles.hCellNum, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}>
                  Cant.
                </Text>
                <Text style={[styles.hCell, styles.hCellNum, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}>
                  Costo
                </Text>
                <Text style={[styles.hCell, styles.hCellNum, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}>
                  Margen
                </Text>
                <Text style={[styles.hCell, styles.hCellNum, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}>
                  Total
                </Text>
                <Text style={[styles.hCell, styles.hCellSource, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}>
                  Origen
                </Text>
                <View style={[styles.hCell, styles.hCellAction]} />
              </View>

              {rows.length === 0 ? (
                <View style={[styles.emptyRow, { borderBottomColor: theme.colors.borderSoft }]}>
                  <Text style={{ color: theme.colors.onSurface }}>No hay items cargados.</Text>
                </View>
              ) : (
                rows.map((row, index) => {
                  const isService = row.kind === 'service';
                  const tint = isService ? serviceTint : materialTint;
                  const busy = isService ? serviceActionsBusy : materialActionsBusy;

                  return (
                    <Pressable
                      key={row.key}
                      onPress={() => {
                        if (isCompleted) return;
                        setEditingTarget({ kind: row.kind, id: row.id });
                      }}
                      disabled={isCompleted || busy}
                      style={({ pressed }) => [pressed && { opacity: 0.8 }]}
                    >
                      <View
                        style={[
                          styles.dataRow,
                          { backgroundColor: tint, borderBottomColor: theme.colors.borderSoft },
                          index > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.borderSoft },
                        ]}
                      >
                        <View style={[styles.dCell, styles.dCellName, { borderRightColor: theme.colors.borderSoft }]}>
                          <Text style={[styles.nameTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={1}>
                            {row.title}
                          </Text>
                          {row.notes ? (
                            <Text style={[styles.nameNotes, { color: theme.colors.textMuted }]} numberOfLines={1}>
                              {row.notes}
                            </Text>
                          ) : null}
                        </View>
                        <Text
                          style={[styles.dCell, styles.dCellNum, styles.dValue, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}
                          numberOfLines={1}
                        >
                          {row.quantity}
                        </Text>
                        <Text
                          style={[styles.dCell, styles.dCellNum, styles.dValue, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}
                          numberOfLines={1}
                        >
                          {row.base}
                        </Text>
                        <Text
                          style={[styles.dCell, styles.dCellNum, styles.dValue, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}
                          numberOfLines={1}
                        >
                          {row.margin}
                        </Text>
                        <Text
                          style={[styles.dCell, styles.dCellNum, styles.dValueStrong, { color: theme.colors.primary, borderRightColor: theme.colors.borderSoft }]}
                          numberOfLines={1}
                        >
                          {row.total}
                        </Text>
                        <Text
                          style={[styles.dCell, styles.dCellSource, styles.dValue, { color: theme.colors.titleOnSoft, borderRightColor: theme.colors.borderSoft }]}
                          numberOfLines={1}
                        >
                          {row.source}
                        </Text>
                        <View style={[styles.dCell, styles.dCellAction]}>
                          <IconButton
                            icon="trash-can-outline"
                            size={16}
                            iconColor="#B00020"
                            onPress={() => {
                              if (isCompleted) return;
                              isService ? onDeleteService(row.id) : onDeleteMaterial(row.id);
                            }}
                            disabled={isCompleted || busy}
                            style={styles.deleteIcon}
                          />
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
          </ScrollView>
        </View>

        <View style={[styles.bottomBar, isCompact && styles.bottomBarCompact]}>
          <View style={[styles.tableActions, isCompact && styles.tableActionsCompact]}>
            <Link href={{ pathname: '/quotes/[id]/add-service', params: { id: quoteId } }} asChild>
              <Button
                mode="contained-tonal"
                icon="plus"
                disabled={isBusy}
                style={serviceAddButtonStyle}
                contentStyle={styles.addButtonContent}
                buttonColor={theme.colors.softBlue}
                textColor={theme.dark ? theme.colors.titleOnSoft : BRAND_BLUE}
              >
                Servicio
              </Button>
            </Link>
            <Link href={{ pathname: '/quotes/[id]/add-material', params: { id: quoteId } }} asChild>
              <Button
                mode="contained-tonal"
                icon="plus"
                disabled={isBusy}
                style={materialAddButtonStyle}
                contentStyle={styles.addButtonContent}
                buttonColor={theme.colors.softGreen}
                textColor={theme.dark ? theme.colors.titleOnSoft : BRAND_GREEN}
              >
                Material
              </Button>
            </Link>
          </View>

          <View style={marginBarStyle}>
            <Text variant="labelMedium" style={[marginLabelStyle, { color: theme.colors.textMuted }]}>
              Margen global %
            </Text>
            <View style={[styles.marginControls, isCompact && styles.marginControlsCompact]}>
              <TextInput
                mode="outlined"
                dense
                value={globalMarginInput}
                onChangeText={onGlobalMarginChange}
                placeholder="15"
                keyboardType="decimal-pad"
                disabled={isBusy}
                style={marginInputStyle}
                outlineStyle={styles.inputOutline}
              />
              <Button
                mode="contained"
                compact
                onPress={onApplyGlobalMargin}
                disabled={isBusy}
                loading={isApplyingGlobalMargin}
                style={marginButtonStyle}
              >
                Aplicar
              </Button>
            </View>
          </View>
        </View>
      </View>

      <Portal>
        <AppDialog visible={Boolean(editingService)} onDismiss={() => setEditingTarget(null)}>
          <Dialog.Title>Editar servicio</Dialog.Title>
          <Dialog.Content>
            {editingService ? (
              <View style={styles.materialEditor}>
                <View style={styles.materialEditorRow}>
                  <TextInput
                    mode="outlined"
                    label="Cantidad"
                    value={serviceQuantityInput}
                    onChangeText={setServiceQuantityInput}
                    keyboardType="decimal-pad"
                    disabled={serviceActionsBusy}
                    style={styles.materialEditorField}
                    outlineStyle={styles.inputOutline}
                  />
                  <TextInput
                    mode="outlined"
                    label="Precio unitario"
                    value={servicePriceInput}
                    onChangeText={setServicePriceInput}
                    keyboardType="decimal-pad"
                    disabled={serviceActionsBusy}
                    style={styles.materialEditorField}
                    outlineStyle={styles.inputOutline}
                  />
                </View>

                <TextInput
                  mode="outlined"
                  label="Margen %"
                  value={serviceMarginInput}
                  onChangeText={setServiceMarginInput}
                  keyboardType="decimal-pad"
                  disabled={serviceActionsBusy}
                  outlineStyle={styles.inputOutline}
                />

                <Button
                  mode="contained"
                  disabled={serviceActionsBusy}
                  loading={savingService}
                  onPress={async () => {
                    const nextQuantity = Number(serviceQuantityInput.trim().replace(',', '.'));
                    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return;

                    const nextPrice = Number(servicePriceInput.trim().replace(',', '.'));
                    if (!Number.isFinite(nextPrice) || nextPrice < 0) return;

                    const trimmedMargin = serviceMarginInput.trim();
                    const nextMargin = trimmedMargin ? Number(trimmedMargin.replace(',', '.')) : null;
                    if (trimmedMargin && (nextMargin == null || !Number.isFinite(nextMargin) || nextMargin < 0)) return;

                    await onSaveService(editingService.id, {
                      quantity: nextQuantity,
                      unit_price: nextPrice,
                      margin_percent: nextMargin,
                    });
                    setEditingTarget(null);
                  }}
                >
                  Guardar cambios
                </Button>
              </View>
            ) : null}
          </Dialog.Content>
        </AppDialog>

        <AppDialog visible={Boolean(editingMaterial)} onDismiss={() => setEditingTarget(null)}>
          <Dialog.Title>Editar material</Dialog.Title>
          <Dialog.Content>
            {editingMaterial ? (
              <View style={styles.materialEditor}>
                <View style={styles.materialEditorRow}>
                  <TextInput
                    mode="outlined"
                    label="Cantidad"
                    value={materialQuantityInput}
                    onChangeText={setMaterialQuantityInput}
                    keyboardType="decimal-pad"
                    disabled={materialActionsBusy}
                    style={styles.materialEditorField}
                    outlineStyle={styles.inputOutline}
                  />
                  <TextInput
                    mode="outlined"
                    label="Costo"
                    value={materialCostInput}
                    onChangeText={setMaterialCostInput}
                    keyboardType="decimal-pad"
                    disabled={materialActionsBusy}
                    style={styles.materialEditorField}
                    outlineStyle={styles.inputOutline}
                  />
                </View>

                <TextInput
                  mode="outlined"
                  label="Margen %"
                  value={materialMarginInput}
                  onChangeText={setMaterialMarginInput}
                  keyboardType="decimal-pad"
                  disabled={materialActionsBusy}
                  outlineStyle={styles.inputOutline}
                />

                <View style={styles.storePickerRow}>
                  <Text variant="labelMedium" style={{ color: theme.colors.textMuted }}>Origen</Text>

                  {selectedStoreName && !storeSearchFocused ? (
                    <View style={styles.storeSelected}>
                      <Text style={[styles.storeSelectedText, { color: theme.colors.onSurface }]}>{selectedStoreName}</Text>
                      <IconButton
                        icon="close-circle"
                        size={18}
                        onPress={() => {
                          setMaterialStoreInput(null);
                          setStoreSearchText('');
                        }}
                        disabled={materialActionsBusy}
                        style={styles.storeClearIcon}
                      />
                    </View>
                  ) : null}

                  <TextInput
                    mode="outlined"
                    placeholder="Buscar tienda..."
                    value={storeSearchText}
                    onChangeText={(text) => {
                      setStoreSearchText(text);
                      setStoreSearchFocused(true);
                    }}
                    onFocus={() => setStoreSearchFocused(true)}
                    disabled={materialActionsBusy}
                    dense
                    outlineStyle={styles.inputOutline}
                    left={<TextInput.Icon icon="magnify" size={18} />}
                    right={storeSearchText ? <TextInput.Icon icon="close" size={18} onPress={() => { setStoreSearchText(''); }} /> : undefined}
                  />

                  {storeSearchFocused ? (
                    <ScrollView
                      style={[styles.storeResults, { borderColor: theme.colors.borderSoft }]}
                      nestedScrollEnabled
                      keyboardShouldPersistTaps="handled"
                    >
                      {filteredStores.length === 0 ? (
                        <Text style={[styles.storeResultEmpty, { color: theme.colors.textMuted }]}>Sin resultados</Text>
                      ) : (
                        filteredStores.map((s) => (
                          <Pressable
                            key={s.id}
                            onPress={() => {
                              setMaterialStoreInput(s.id);
                              setStoreSearchText('');
                              setStoreSearchFocused(false);
                            }}
                            style={({ pressed }) => [
                              styles.storeResultItem,
                              { backgroundColor: s.id === materialStoreInput ? theme.colors.surfaceSoft : pressed ? theme.colors.surfaceSoft : 'transparent' },
                            ]}
                          >
                            <Text style={{ color: theme.colors.onSurface, fontSize: 14 }}>{s.name}</Text>
                          </Pressable>
                        ))
                      )}
                    </ScrollView>
                  ) : null}
                </View>

                <Button
                  mode="contained"
                  disabled={materialActionsBusy}
                  loading={savingMaterial}
                  onPress={async () => {
                    const nextQuantity = Number(materialQuantityInput.trim().replace(',', '.'));
                    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) return;

                    const nextUnitPrice = Number(materialCostInput.trim().replace(',', '.'));
                    if (!Number.isFinite(nextUnitPrice) || nextUnitPrice < 0) return;

                    const trimmedMargin = materialMarginInput.trim();
                    const nextMargin = trimmedMargin ? Number(trimmedMargin.replace(',', '.')) : null;
                    if (trimmedMargin && (nextMargin == null || !Number.isFinite(nextMargin) || nextMargin < 0)) return;

                    await onSaveMaterial(editingMaterial.id, {
                      quantity: nextQuantity,
                      unit: editingMaterial.unit ?? null,
                      unit_price: nextUnitPrice,
                      margin_percent: nextMargin,
                      source_store_id: materialStoreInput,
                    });
                    setEditingTarget(null);
                  }}
                >
                  Guardar cambios
                </Button>
              </View>
            ) : null}
          </Dialog.Content>
        </AppDialog>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  tableWrap: {
    position: 'relative',
  },
  table: {
    minWidth: 520,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
  },
  hCell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRightWidth: 1,
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: '500',
  },
  hCellName: {
    flex: 1,
    minWidth: 80,
  },
  hCellNum: {
    width: 68,
    textAlign: 'right',
  },
  hCellSource: {
    width: 72,
  },
  hCellAction: {
    width: 36,
    borderRightWidth: 0,
  },
  nameTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  nameNotes: {
    fontSize: 10,
    lineHeight: 13,
  },
  deleteIcon: {
    margin: 0,
    width: 28,
    height: 28,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    minHeight: 38,
  },
  dCell: {
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  dCellName: {
    flex: 1,
    minWidth: 80,
    justifyContent: 'center',
  },
  dCellNum: {
    width: 68,
    textAlign: 'right',
  },
  dCellSource: {
    width: 72,
  },
  dCellAction: {
    width: 36,
    borderRightWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dValue: {
    fontSize: 11,
    fontWeight: '500',
  },
  dValueStrong: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyRow: {
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
  },
  bottomBarCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  tableActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tableActionsCompact: {
    width: '100%',
  },
  addButton: {
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 140,
  },
  serviceAddButton: {
    borderColor: 'rgba(5, 38, 83, 0.14)',
  },
  materialAddButton: {
    borderColor: 'rgba(67, 102, 61, 0.16)',
  },
  addButtonContent: {
    minHeight: 42,
    paddingHorizontal: 8,
  },
  addButtonCompact: {
    flex: 1,
  },
  marginBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  marginBarCompact: {
    width: '100%',
    alignItems: 'stretch',
    gap: 8,
  },
  marginLabel: {
    minWidth: 108,
  },
  marginLabelCompact: {
    minWidth: 0,
  },
  marginControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  marginControlsCompact: {
    width: '100%',
    flexWrap: 'nowrap',
  },
  marginInput: {
    width: 110,
    minWidth: 110,
  },
  marginInputCompact: {
    flex: 1,
    minWidth: 0,
    width: undefined,
  },
  marginButton: {
    borderRadius: 10,
  },
  marginButtonCompact: {
    flexShrink: 0,
  },
  inputOutline: {
    borderRadius: 10,
  },
  materialEditor: {
    gap: 12,
  },
  materialEditorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  materialEditorField: {
    flex: 1,
  },
  storePickerRow: {
    gap: 6,
  },
  storeSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storeSelectedText: {
    flex: 1,
    fontSize: 14,
  },
  storeClearIcon: {
    margin: 0,
    width: 28,
    height: 28,
  },
  storeResults: {
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 160,
    overflow: 'hidden',
  },
  storeResultEmpty: {
    padding: 12,
    textAlign: 'center',
  },
  storeResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
});
