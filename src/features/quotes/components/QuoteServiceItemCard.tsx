import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, Text } from 'react-native-paper';

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
    <Card mode="outlined" style={styles.card}>
      <Card.Content style={styles.content}>
        <Text variant="titleMedium">{item.service_name_snapshot}</Text>
        <Text>
          {item.quantity} x {formatCurrencyArs(item.unit_price)} = {formatCurrencyArs(item.total_price)}
        </Text>
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
  },
  content: {
    gap: 10,
    paddingVertical: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
    marginTop: 2,
  },
});
