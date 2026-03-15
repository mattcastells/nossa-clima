import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Card, Dialog, IconButton, Portal, Text, TextInput } from 'react-native-paper';

import type { QuoteMaterialItem, QuoteServiceItem, Store } from '@/types/db';

import { formatCurrencyArs, formatPercent } from '@/lib/format';

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
    payload: Pick<QuoteMaterialItem, 'quantity' | 'unit_price' | 'margin_percent' | 'source_store_id' | 'notes'>,
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
  const [editingTarget, setEditingTarget] = useState<EditingTarget>(null);
  const isCompact = width < 520;
  const serviceActionsBusy = isBusy || savingService || deletingService;
  const materialActionsBusy = isBusy || savingMaterial || deletingMaterial;
  const addButtonStyle = StyleSheet.flatten([styles.addButton, isCompact && styles.addButtonCompact]);
  const marginBarStyle = StyleSheet.flatten([styles.marginBar, isCompact && styles.marginBarCompact]);
  const marginLabelStyle = StyleSheet.flatten([styles.marginLabel, isCompact && styles.marginLabelCompact]);
  const marginInputStyle = StyleSheet.flatten([styles.marginInput, isCompact && styles.marginInputCompact]);
  const marginButtonStyle = StyleSheet.flatten([styles.marginButton, isCompact && styles.marginButtonCompact]);
  const descriptionHeaderStyle = StyleSheet.flatten([styles.cell, styles.descriptionCell, styles.headerText]);
  const quantityHeaderStyle = StyleSheet.flatten([styles.cell, styles.quantityCell, styles.headerText]);
  const baseHeaderStyle = StyleSheet.flatten([styles.cell, styles.baseCell, styles.headerText]);
  const marginHeaderStyle = StyleSheet.flatten([styles.cell, styles.marginCell, styles.headerText]);
  const saleHeaderStyle = StyleSheet.flatten([styles.cell, styles.saleCell, styles.headerText]);
  const totalHeaderStyle = StyleSheet.flatten([styles.cell, styles.totalCell, styles.headerText]);
  const sourceHeaderStyle = StyleSheet.flatten([styles.cell, styles.sourceCell, styles.headerText]);
  const removeHeaderStyle = StyleSheet.flatten([styles.cell, styles.actionsCell, styles.headerText]);

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
          source: sourceStoreName ?? 'Sin tienda',
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
            <View style={styles.table}>
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
                Remover
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
                      style={({ pressed }) => [styles.cell, styles.descriptionCell, pressed && styles.editingCellPressed]}
                    >
                      <Text variant="titleSmall" style={styles.itemTitle}>
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
                      style={({ pressed }) => [styles.cell, styles.quantityCell, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.quantity}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [styles.cell, styles.baseCell, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.base}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [styles.cell, styles.marginCell, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.margin}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [styles.cell, styles.saleCell, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.saleUnit}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [styles.cell, styles.totalCell, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.strongValue}>{row.total}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEditingTarget({ kind: row.kind, id: row.id })}
                      disabled={row.kind === 'service' ? serviceActionsBusy : materialActionsBusy}
                      style={({ pressed }) => [styles.cell, styles.sourceCell, pressed && styles.editingCellPressed]}
                    >
                      <Text style={styles.valueText}>{row.source}</Text>
                    </Pressable>
                    <View style={[styles.cell, styles.actionsCell, styles.deleteCell]}>
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
              <Button mode="contained-tonal" icon="plus" compact disabled={isBusy} style={addButtonStyle}>
                Servicio
              </Button>
            </Link>
            <Link href={{ pathname: '/quotes/[id]/add-material', params: { id: quoteId } }} asChild>
              <Button
                mode="contained-tonal"
                icon="plus"
                compact
                disabled={isBusy || services.length === 0}
                style={addButtonStyle}
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
        <Dialog visible={Boolean(editingService)} onDismiss={() => setEditingTarget(null)}>
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
        </Dialog>

        <Dialog visible={Boolean(editingMaterial)} onDismiss={() => setEditingTarget(null)}>
          <Dialog.Title>Editar material</Dialog.Title>
          <Dialog.Content>
            {editingMaterial ? (
              <QuoteMaterialItemForm
                stores={stores}
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
                    quantity: values.quantity,
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
        </Dialog>
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
  row: {
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
    borderLeftWidth: 4,
    borderLeftColor: '#A9C8E7',
  },
  materialRow: {
    borderLeftWidth: 4,
    borderLeftColor: '#C9DDB7',
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
  quantityCell: {
    width: 64,
  },
  baseCell: {
    width: 128,
  },
  marginCell: {
    width: 92,
  },
  saleCell: {
    width: 132,
  },
  totalCell: {
    width: 138,
  },
  sourceCell: {
    width: 132,
  },
  actionsCell: {
    width: 72,
    borderRightWidth: 0,
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
  itemNotes: {
    color: '#5f6368',
    lineHeight: 18,
  },
  valueText: {
    fontWeight: '500',
  },
  strongValue: {
    fontWeight: '700',
  },
});
