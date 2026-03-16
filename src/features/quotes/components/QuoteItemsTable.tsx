import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Card, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { useItems } from '@/features/items/hooks';
import { useLatestPrices } from '@/features/prices/hooks';
import type { QuoteMaterialItem, QuoteServiceItem, Store } from '@/types/db';

import { formatCurrencyArs, formatPercent } from '@/lib/format';
import { BRAND_BLUE, BRAND_GREEN } from '@/theme';

import { getEffectiveMaterialMarginPercent, getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from '../materialPricing';
import { QuoteMaterialItemForm } from './QuoteMaterialItemForm';
import { QuoteServiceItemForm } from './QuoteServiceItemForm';

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
  onSaveService: (itemId: string, payload: Pick<QuoteServiceItem, 'quantity' | 'unit_price' | 'notes'>) => Promise<void>;
  onDeleteService: (itemId: string) => void;
  onSaveMaterial: (
    itemId: string,
    payload: Pick<QuoteMaterialItem, 'item_id' | 'quantity' | 'unit' | 'unit_price' | 'margin_percent' | 'source_store_id' | 'notes'>,
  ) => Promise<void>;
  onDeleteMaterial: (itemId: string) => void;
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
  isBusy = false,
  isApplyingGlobalMargin = false,
  savingService = false,
  deletingService = false,
  savingMaterial = false,
  deletingMaterial = false,
}: Props) => {
  const { width } = useWindowDimensions();
  const itemsQuery = useItems(materials.map((item) => item.item_id));
  const latestPricesQuery = useLatestPrices();
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const isCompact = width < 520;
  const serviceActionsBusy = isBusy || savingService || deletingService;
  const materialActionsBusy = isBusy || savingMaterial || deletingMaterial;
  const addButtonStyle = StyleSheet.flatten([styles.addButton, isCompact && styles.addButtonCompact]);
  const serviceAddButtonStyle = StyleSheet.flatten([addButtonStyle, styles.serviceAddButton]);
  const materialAddButtonStyle = StyleSheet.flatten([addButtonStyle, styles.materialAddButton]);
  const marginBarStyle = StyleSheet.flatten([styles.marginBar, isCompact && styles.marginBarCompact]);
  const marginLabelStyle = StyleSheet.flatten([styles.marginLabel, isCompact && styles.marginLabelCompact]);
  const marginInputStyle = StyleSheet.flatten([styles.marginInput, isCompact && styles.marginInputCompact]);
  const marginButtonStyle = StyleSheet.flatten([styles.marginButton, isCompact && styles.marginButtonCompact]);
  const tableStyle = StyleSheet.flatten([styles.table, isCompact && styles.tableCompact]);
  const descriptionCellStyle = StyleSheet.flatten([styles.cell, styles.descriptionCell, isCompact && styles.descriptionCellCompact]);
  const quantityCellStyle = StyleSheet.flatten([styles.cell, styles.quantityCell, isCompact && styles.quantityCellCompact]);
  const baseCellStyle = StyleSheet.flatten([styles.cell, styles.baseCell, isCompact && styles.baseCellCompact]);
  const marginCellStyle = StyleSheet.flatten([styles.cell, styles.marginCell, isCompact && styles.marginCellCompact]);
  const saleCellStyle = StyleSheet.flatten([styles.cell, styles.saleCell, isCompact && styles.saleCellCompact]);
  const totalCellStyle = StyleSheet.flatten([styles.cell, styles.totalCell, isCompact && styles.totalCellCompact]);
  const sourceCellStyle = StyleSheet.flatten([styles.cell, styles.sourceCell, isCompact && styles.sourceCellCompact]);
  const actionsCellStyle = StyleSheet.flatten([styles.cell, styles.actionsCell, isCompact && styles.actionsCellCompact]);
  const descriptionHeaderStyle = StyleSheet.flatten([descriptionCellStyle, styles.headerText]);
  const quantityHeaderStyle = StyleSheet.flatten([quantityCellStyle, styles.headerText]);
  const baseHeaderStyle = StyleSheet.flatten([baseCellStyle, styles.headerText]);
  const marginHeaderStyle = StyleSheet.flatten([marginCellStyle, styles.headerText]);
  const saleHeaderStyle = StyleSheet.flatten([saleCellStyle, styles.headerText]);
  const totalHeaderStyle = StyleSheet.flatten([totalCellStyle, styles.headerText]);
  const sourceHeaderStyle = StyleSheet.flatten([sourceCellStyle, styles.headerText]);
  const removeHeaderStyle = StyleSheet.flatten([actionsCellStyle, styles.headerText]);

  const editingService = editingTarget?.kind === 'service' ? services.find((item) => item.id === editingTarget.id) ?? null : null;
  const editingMaterial = editingTarget?.kind === 'material' ? materials.find((item) => item.id === editingTarget.id) ?? null : null;

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
        margin: '-',
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
          margin: `${formatPercent(effectiveMargin)}${usesGlobalMargin ? ' global' : ''}`,
          saleUnit: formatCurrencyArs(effectiveUnitPrice),
          total: formatCurrencyArs(effectiveTotalPrice),
          source: sourceStoreName ?? item.source_store_name_snapshot ?? 'Sin tienda',
        };
      }),
    ],
    [defaultMarginPercent, materials, services, stores],
  );

  return (
    <Card mode="contained" style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.tableWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={tableStyle}>
            <View style={[styles.row, styles.headerRow]}>
              <Text variant="labelMedium" style={descriptionHeaderStyle}>
                Servicios y materiales
              </Text>
              <Text variant="labelMedium" style={quantityHeaderStyle}>
                Cant.
              </Text>
              <Text variant="labelMedium" style={baseHeaderStyle}>
                Costo/Base
              </Text>
              <Text variant="labelMedium" style={marginHeaderStyle}>
                Margen
              </Text>
              <Text variant="labelMedium" style={saleHeaderStyle}>
                Venta unit.
              </Text>
              <Text variant="labelMedium" style={totalHeaderStyle}>
                Total
              </Text>
              <Text variant="labelMedium" style={sourceHeaderStyle}>
                Origen
              </Text>
              <Text variant="labelMedium" style={removeHeaderStyle}>
                Quitar
              </Text>
            </View>

              {rows.length === 0 ? (
                <View style={[styles.row, styles.emptyRow]}>
                  <Text>No hay items cargados.</Text>
                </View>
              ) : (
                rows.map((row, index) => (
                  <View
                    key={row.key}
                    style={[
                      styles.row,
                      index % 2 === 0 ? styles.evenRow : styles.oddRow,
                      row.kind === 'service' ? styles.serviceRow : styles.materialRow,
                    ]}
                  >
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [
                        descriptionCellStyle,
                        row.kind === 'service' ? styles.serviceDescriptionCell : styles.materialDescriptionCell,
                        pressed && styles.editingCellPressed,
                      ]}
                    >
                      <Text
                        variant="titleSmall"
                        style={[
                          styles.itemTitle,
                          row.kind === 'service' ? styles.serviceItemTitle : styles.materialItemTitle,
                        ]}
                      >
                        {row.title}
                      </Text>
                      {row.notes ? (
                        <Text variant="bodySmall" style={styles.itemNotes}>
                          {row.notes}
                        </Text>
                      ) : null}
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [quantityCellStyle, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.quantity}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [baseCellStyle, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.base}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [marginCellStyle, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.margin}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [saleCellStyle, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.saleUnit}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [totalCellStyle, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.strongValue}>{row.total}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [sourceCellStyle, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.source}</Text>
                    </Pressable>
                    <View style={[actionsCellStyle, styles.deleteCell]}>
                      <IconButton
                        icon="trash-can-outline"
                        size={20}
                        iconColor="#B00020"
                        onPress={() => (row.kind === 'service' ? onDeleteService(row.id) : onDeleteMaterial(row.id))}
                        disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      />
                    </View>
                  </View>
                ))
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
                buttonColor="#D9E6F6"
                textColor={BRAND_BLUE}
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
                buttonColor="#E2ECD6"
                textColor={BRAND_GREEN}
              >
                Material
              </Button>
            </Link>
          </View>

          <View style={marginBarStyle}>
            <Text variant="labelMedium" style={marginLabelStyle}>
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
      </Card.Content>

      <Portal>
        <AppDialog visible={Boolean(editingService)} onDismiss={() => setEditingTarget(null)}>
          <Dialog.Title>Editar servicio</Dialog.Title>
          <Dialog.Content>
            {editingService ? (
              <QuoteServiceItemForm
                defaultValues={{
                  quote_id: editingService.quote_id,
                  service_id: editingService.service_id,
                  quantity: editingService.quantity,
                  unit_price: editingService.unit_price,
                  notes: editingService.notes ?? '',
                }}
                submitLabel="Guardar cambios"
                onSubmit={async (values) => {
                  await onSaveService(editingService.id, {
                    quantity: values.quantity,
                    unit_price: values.unit_price,
                    notes: values.notes ?? null,
                  });
                  setEditingTarget(null);
                }}
              />
            ) : null}
          </Dialog.Content>
        </AppDialog>

        <AppDialog visible={Boolean(editingMaterial)} onDismiss={() => setEditingTarget(null)}>
          <Dialog.Title>Editar material</Dialog.Title>
          <Dialog.Content>
            {editingMaterial ? (
              <QuoteMaterialItemForm
                stores={stores}
                items={itemsQuery.data ?? []}
                latestPrices={latestPricesQuery.data ?? []}
                isCatalogLoading={itemsQuery.isLoading || latestPricesQuery.isLoading}
                defaultValues={{
                  quote_id: editingMaterial.quote_id,
                  item_id: editingMaterial.item_id,
                  quantity: editingMaterial.quantity,
                  unit: editingMaterial.unit ?? '',
                  unit_price: editingMaterial.unit_price,
                  margin_percent: editingMaterial.margin_percent,
                  source_store_id: editingMaterial.source_store_id,
                  notes: editingMaterial.notes ?? '',
                }}
                defaultMarginPercent={defaultMarginPercent}
                submitLabel="Guardar cambios"
                onSubmit={async (values) => {
                  await onSaveMaterial(editingMaterial.id, {
                    item_id: values.item_id,
                    quantity: values.quantity,
                    unit: values.unit ?? null,
                    unit_price: values.unit_price,
                    margin_percent: values.margin_percent ?? null,
                    source_store_id: values.source_store_id ?? null,
                    notes: values.notes ?? null,
                  });
                  setEditingTarget(null);
                }}
              />
            ) : null}
          </Dialog.Content>
        </AppDialog>
      </Portal>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE4EC',
  },
  content: {
    gap: 12,
    paddingVertical: 10,
  },
  tableWrap: {
    position: 'relative',
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
    color: '#5f6368',
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
  table: {
    minWidth: 1040,
    borderWidth: 1,
    borderColor: '#DCE4EC',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableCompact: {
    minWidth: 890,
  },
  row: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#DCE4EC',
  },
  headerRow: {
    backgroundColor: '#EAF1F8',
  },
  headerText: {
    fontWeight: '700',
    color: '#33506C',
  },
  evenRow: {
    backgroundColor: '#FFFFFF',
  },
  oddRow: {
    backgroundColor: '#F9FBFD',
  },
  serviceRow: {
  },
  materialRow: {
  },
  emptyRow: {
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  cell: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: '#E1E7EF',
    justifyContent: 'center',
  },
  descriptionCell: {
    width: 280,
    gap: 4,
  },
  descriptionCellCompact: {
    width: 220,
  },
  serviceDescriptionCell: {
    backgroundColor: '#E8F0FA',
  },
  materialDescriptionCell: {
    backgroundColor: '#ECF3E3',
  },
  quantityCell: {
    width: 64,
  },
  quantityCellCompact: {
    width: 72,
  },
  baseCell: {
    width: 128,
  },
  baseCellCompact: {
    width: 122,
  },
  marginCell: {
    width: 92,
  },
  marginCellCompact: {
    width: 108,
  },
  saleCell: {
    width: 132,
  },
  saleCellCompact: {
    width: 124,
  },
  totalCell: {
    width: 138,
  },
  totalCellCompact: {
    width: 128,
  },
  sourceCell: {
    width: 132,
  },
  sourceCellCompact: {
    width: 116,
  },
  actionsCell: {
    width: 84,
    borderRightWidth: 0,
  },
  actionsCellCompact: {
    width: 72,
  },
  deleteCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editingCellPressed: {
    backgroundColor: '#F2F7FC',
  },
  itemTitle: {
    fontWeight: '600',
  },
  serviceItemTitle: {
    color: BRAND_BLUE,
  },
  materialItemTitle: {
    color: BRAND_GREEN,
  },
  itemNotes: {
    color: '#5f6368',
    lineHeight: 18,
    marginTop: 6,
  },
  valueText: {
    fontWeight: '500',
  },
  strongValue: {
    fontWeight: '700',
  },
});
