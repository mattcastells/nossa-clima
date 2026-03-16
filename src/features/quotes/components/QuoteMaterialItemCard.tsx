import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Divider, Portal, Text } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { useItems } from '@/features/items/hooks';
import { useLatestPrices } from '@/features/prices/hooks';
import type { QuoteMaterialItem, Store } from '@/types/db';

import { formatCurrencyArs, formatPercent } from '@/lib/format';
import { BRAND_GREEN, BRAND_GREEN_MID, BRAND_GREEN_SOFT } from '@/theme';

import { QuoteMaterialItemForm } from './QuoteMaterialItemForm';
import { getEffectiveMaterialMarginPercent, getMaterialEffectiveTotalPrice, getMaterialEffectiveUnitPrice } from '../materialPricing';

interface Props {
  item: QuoteMaterialItem;
  stores: Store[];
  onSave: (
    itemId: string,
    payload: Pick<QuoteMaterialItem, 'item_id' | 'quantity' | 'unit' | 'unit_price' | 'margin_percent' | 'source_store_id' | 'notes'>,
  ) => Promise<void>;
  onDuplicate: (itemId: string) => Promise<void>;
  onDelete: (itemId: string) => void;
  saving?: boolean;
  duplicating?: boolean;
  deleting?: boolean;
  defaultMarginPercent?: number | null;
}

export const QuoteMaterialItemCard = ({
  item,
  stores,
  onSave,
  onDuplicate,
  onDelete,
  saving = false,
  duplicating = false,
  deleting = false,
  defaultMarginPercent = null,
}: Props) => {
  const itemsQuery = useItems([item.item_id]);
  const latestPricesQuery = useLatestPrices();
  const [editing, setEditing] = useState(false);
  const sourceStoreName = item.source_store_id ? stores.find((store) => store.id === item.source_store_id)?.name ?? null : null;
  const effectiveMargin = getEffectiveMaterialMarginPercent(item.margin_percent, defaultMarginPercent);
  const effectiveUnitPrice = getMaterialEffectiveUnitPrice(item.unit_price, item.margin_percent, defaultMarginPercent);
  const effectiveTotalPrice = getMaterialEffectiveTotalPrice(item.quantity, item.unit_price, item.margin_percent, defaultMarginPercent);
  const usesGlobalMargin = item.margin_percent == null && defaultMarginPercent != null;

  return (
    <Card mode="outlined" style={[styles.card, styles.materialCard]}>
      <Card.Content style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <View style={styles.badge}>
              <Text variant="labelSmall" style={styles.badgeText}>
                Material
              </Text>
            </View>
            <Text variant="titleSmall" style={styles.headerTitle}>
              {item.item_name_snapshot}
            </Text>
            {item.notes ? (
              <Text variant="bodySmall" style={styles.notes}>
                {item.notes}
              </Text>
            ) : null}
          </View>
          <View style={styles.totalBlock}>
            <Text variant="labelSmall" style={styles.totalLabel}>
              Total
            </Text>
            <Text variant="titleMedium" style={styles.totalValue}>
              {formatCurrencyArs(effectiveTotalPrice)}
            </Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCell}>
            <Text variant="labelSmall" style={styles.metricLabel}>
              Cantidad
            </Text>
            <Text variant="bodyMedium" style={styles.metricValue}>
              {item.quantity}
              {item.unit ? ` ${item.unit}` : ''}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text variant="labelSmall" style={styles.metricLabel}>
              Costo
            </Text>
            <Text variant="bodyMedium" style={styles.metricValue}>
              {formatCurrencyArs(item.unit_price)}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text variant="labelSmall" style={styles.metricLabel}>
              Margen
            </Text>
            <Text variant="bodyMedium" style={styles.metricValue}>
              {formatPercent(effectiveMargin)}
              {usesGlobalMargin ? ' global' : ''}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text variant="labelSmall" style={styles.metricLabel}>
              Venta unit.
            </Text>
            <Text variant="bodyMedium" style={styles.metricValue}>
              {formatCurrencyArs(effectiveUnitPrice)}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text variant="labelSmall" style={styles.metricLabel}>
              Origen
            </Text>
            <Text variant="bodyMedium" style={styles.metricValue}>
              {sourceStoreName ?? item.source_store_name_snapshot ?? 'Sin tienda'}
            </Text>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.actionsRow}>
          <Button mode="text" onPress={() => setEditing(true)} disabled={saving || duplicating || deleting} compact>
            Editar
          </Button>
          <Button mode="text" onPress={() => onDuplicate(item.id)} loading={duplicating} disabled={saving || duplicating || deleting} compact>
            Duplicar
          </Button>
          <Button mode="text" textColor="#B00020" onPress={() => onDelete(item.id)} disabled={saving || duplicating || deleting} compact>
            Eliminar
          </Button>
        </View>
      </Card.Content>

      <Portal>
        <AppDialog visible={editing} onDismiss={() => setEditing(false)}>
          <Dialog.Title>Editar material</Dialog.Title>
          <Dialog.Content>
            <QuoteMaterialItemForm
              stores={stores}
              items={itemsQuery.data ?? []}
              latestPrices={latestPricesQuery.data ?? []}
              isCatalogLoading={itemsQuery.isLoading || latestPricesQuery.isLoading}
              defaultValues={{
                quote_id: item.quote_id,
                item_id: item.item_id,
                quantity: item.quantity,
                unit: item.unit ?? '',
                unit_price: item.unit_price,
                margin_percent: item.margin_percent,
                source_store_id: item.source_store_id,
                notes: item.notes ?? '',
              }}
              defaultMarginPercent={defaultMarginPercent}
              submitLabel="Guardar cambios"
              onSubmit={async (values) => {
                await onSave(item.id, {
                  item_id: values.item_id,
                  quantity: values.quantity,
                  unit: values.unit ?? null,
                  unit_price: values.unit_price,
                  margin_percent: values.margin_percent ?? null,
                  source_store_id: values.source_store_id ?? null,
                  notes: values.notes ?? null,
                });
                setEditing(false);
              }}
            />
          </Dialog.Content>
        </AppDialog>
      </Portal>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderColor: '#C9D6E4',
    backgroundColor: '#FFFFFF',
  },
  materialCard: {
    backgroundColor: '#FBFCFE',
  },
  content: {
    gap: 14,
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    gap: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: BRAND_GREEN_SOFT,
  },
  badgeText: {
    color: BRAND_GREEN,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontWeight: '600',
  },
  notes: {
    color: '#5f6368',
    lineHeight: 18,
  },
  totalBlock: {
    minWidth: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F7FAF6',
    borderWidth: 1,
    borderColor: BRAND_GREEN_MID,
  },
  totalLabel: {
    color: '#5f6368',
    marginBottom: 2,
  },
  totalValue: {
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCell: {
    flexGrow: 1,
    minWidth: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FBFCFA',
    borderWidth: 1,
    borderColor: BRAND_GREEN_MID,
  },
  metricLabel: {
    color: '#5f6368',
    marginBottom: 4,
  },
  metricValue: {
    fontWeight: '600',
  },
  divider: {
    backgroundColor: '#E1E7EF',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
});
