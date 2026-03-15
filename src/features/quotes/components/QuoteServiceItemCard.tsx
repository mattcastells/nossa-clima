import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Divider, Portal, Text } from 'react-native-paper';

import type { QuoteServiceItem } from '@/types/db';

import { formatCurrencyArs } from '@/lib/format';

import { QuoteServiceItemForm } from './QuoteServiceItemForm';

interface Props {
  item: QuoteServiceItem;
  onSave: (itemId: string, payload: Pick<QuoteServiceItem, 'quantity' | 'unit_price' | 'notes'>) => Promise<void>;
  onDuplicate: (itemId: string) => Promise<void>;
  onDelete: (itemId: string) => void;
  saving?: boolean;
  duplicating?: boolean;
  deleting?: boolean;
}

export const QuoteServiceItemCard = ({ item, onSave, onDuplicate, onDelete, saving = false, duplicating = false, deleting = false }: Props) => {
  const [editing, setEditing] = useState(false);

  return (
    <Card mode="outlined" style={[styles.card, styles.serviceCard]}>
      <Card.Content style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <View style={styles.badge}>
              <Text variant="labelSmall" style={styles.badgeText}>
                Servicio
              </Text>
            </View>
            <Text variant="titleSmall" style={styles.headerTitle}>
              {item.service_name_snapshot}
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
              {formatCurrencyArs(item.total_price)}
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
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text variant="labelSmall" style={styles.metricLabel}>
              Unitario
            </Text>
            <Text variant="bodyMedium" style={styles.metricValue}>
              {formatCurrencyArs(item.unit_price)}
            </Text>
          </View>
          <View style={styles.metricCell}>
            <Text variant="labelSmall" style={styles.metricLabel}>
              Calculo
            </Text>
            <Text variant="bodyMedium" style={styles.metricValue}>
              {item.quantity} x {formatCurrencyArs(item.unit_price)}
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
        <Dialog visible={editing} onDismiss={() => setEditing(false)}>
          <Dialog.Title>Editar servicio</Dialog.Title>
          <Dialog.Content>
            <QuoteServiceItemForm
              defaultValues={{
                quote_id: item.quote_id,
                service_id: item.service_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                notes: item.notes ?? '',
              }}
              submitLabel="Guardar cambios"
              onSubmit={async (values) => {
                await onSave(item.id, {
                  quantity: values.quantity,
                  unit_price: values.unit_price,
                  notes: values.notes ?? null,
                });
                setEditing(false);
              }}
            />
          </Dialog.Content>
        </Dialog>
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
  serviceCard: {
    backgroundColor: '#FCFEFF',
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
    backgroundColor: '#E8F1FB',
  },
  badgeText: {
    color: '#1F4D7A',
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
    backgroundColor: '#F4F7FB',
    borderWidth: 1,
    borderColor: '#DCE4EC',
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
    backgroundColor: '#F8FAFD',
    borderWidth: 1,
    borderColor: '#E1E7EF',
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
