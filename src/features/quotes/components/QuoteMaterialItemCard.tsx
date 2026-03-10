import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Dialog, Portal, Text } from 'react-native-paper';

import type { QuoteMaterialItem, Store } from '@/types/db';

import { formatCurrencyArs, formatPercent } from '@/lib/format';

import { QuoteMaterialItemForm } from './QuoteMaterialItemForm';

interface Props {
  item: QuoteMaterialItem;
  stores: Store[];
  onSave: (itemId: string, payload: Pick<QuoteMaterialItem, 'quantity' | 'unit_price' | 'margin_percent' | 'source_store_id' | 'notes'>) => Promise<void>;
  onDuplicate: (itemId: string) => Promise<void>;
  onDelete: (itemId: string) => void;
  saving?: boolean;
  duplicating?: boolean;
  deleting?: boolean;
}

export const QuoteMaterialItemCard = ({ item, stores, onSave, onDuplicate, onDelete, saving = false, duplicating = false, deleting = false }: Props) => {
  const [editing, setEditing] = useState(false);

  return (
    <Card>
      <Card.Content style={{ gap: 6 }}>
        <Text variant="titleMedium">{item.item_name_snapshot}</Text>
        <Text>
          {item.quantity} x {formatCurrencyArs(item.unit_price)} = {formatCurrencyArs(item.total_price)}
        </Text>
        <Text>Margen: {formatPercent(item.margin_percent)}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button mode="outlined" onPress={() => setEditing(true)} disabled={saving || duplicating || deleting}>
            Editar
          </Button>
          <Button mode="outlined" onPress={() => onDuplicate(item.id)} loading={duplicating} disabled={saving || duplicating || deleting}>
            Duplicar
          </Button>
          <Button mode="outlined" textColor="#B00020" onPress={() => onDelete(item.id)} disabled={saving || duplicating || deleting}>
            Eliminar
          </Button>
        </View>
      </Card.Content>

      <Portal>
        <Dialog visible={editing} onDismiss={() => setEditing(false)}>
          <Dialog.Title>Editar material</Dialog.Title>
          <Dialog.Content>
            <QuoteMaterialItemForm
              stores={stores}
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
              submitLabel="Guardar cambios"
              onSubmit={async (values) => {
                await onSave(item.id, {
                  quantity: values.quantity,
                  unit_price: values.unit_price,
                  margin_percent: values.margin_percent ?? null,
                  source_store_id: values.source_store_id ?? null,
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
