import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Menu, Snackbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { ItemForm } from '@/features/items/ItemForm';
import { useSaveItem } from '@/features/items/hooks';
import { useCreatePrice } from '@/features/prices/hooks';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';

const parsePriceInput = (value: string): number | null => {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
};

export default function NewItemPage() {
  const save = useSaveItem();
  const createPrice = useCreatePrice();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();

  const [message, setMessage] = useState<string | null>(null);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [initialPriceInput, setInitialPriceInput] = useState('');

  const activeStores = useMemo(() => (stores ?? []).filter((store) => store.is_active), [stores]);
  const selectedStore = activeStores.find((store) => store.id === selectedStoreId) ?? null;

  return (
    <AppScreen title="Nuevo item">
      <LoadingOrError isLoading={storesLoading} error={storesError ? new Error(storesError.message) : null} />

      <ItemForm
        onSubmit={async (values) => {
          const parsedPrice = parsePriceInput(initialPriceInput);

          if (selectedStoreId && parsedPrice == null) {
            setMessage('Si elegis una tienda, completa el precio inicial.');
            return;
          }

          if (!selectedStoreId && parsedPrice != null) {
            setMessage('Si cargas un precio inicial, primero elegi la tienda.');
            return;
          }

          if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
            setMessage('El precio inicial debe ser un numero mayor a 0.');
            return;
          }

          try {
            const createdItem = await save.mutateAsync({
              name: values.name,
              item_type: values.item_type,
              is_active: true,
              category: values.category?.trim() ? values.category.trim() : null,
              unit: values.unit?.trim() ? values.unit.trim() : null,
              brand: values.brand?.trim() ? values.brand.trim() : null,
              sku: values.sku?.trim() ? values.sku.trim() : null,
              description: values.description?.trim() ? values.description.trim() : null,
            });

            if (selectedStoreId && parsedPrice != null) {
              try {
                await createPrice.mutateAsync({
                  store_id: selectedStoreId,
                  item_id: createdItem.id,
                  price: parsedPrice,
                  currency: 'ARS',
                  observed_at: new Date().toISOString(),
                  source_type: 'manual_update',
                  quantity_reference: null,
                  notes: 'Precio inicial del item',
                });
              } catch (priceError) {
                setMessage(toUserErrorMessage(priceError, 'El item se guardo, pero fallo la asociacion de precio con tienda.'));
                return;
              }
            }

            router.back();
          } catch (error) {
            setMessage(toUserErrorMessage(error, 'No se pudo guardar el item.'));
          }
        }}
      />

      <Card mode="outlined" style={styles.pricingCard}>
        <Card.Content style={styles.pricingCardContent}>
          <Text variant="titleSmall">Precio inicial (opcional)</Text>
          <Text style={styles.helperText}>Asocia el item a una tienda y registra su primer precio.</Text>

          <View style={styles.fieldGroup}>
            <Text variant="labelMedium">Tienda</Text>
            <Menu
              visible={storeMenuVisible}
              onDismiss={() => setStoreMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  icon="chevron-down"
                  onPress={() => setStoreMenuVisible(true)}
                  style={styles.selectButton}
                  contentStyle={styles.selectButtonContent}
                  disabled={activeStores.length === 0}
                >
                  {selectedStore?.name ?? (activeStores.length === 0 ? 'Sin tiendas activas' : 'Seleccionar tienda')}
                </Button>
              }
            >
              <Menu.Item
                title="Sin tienda"
                onPress={() => {
                  setSelectedStoreId('');
                  setStoreMenuVisible(false);
                }}
              />
              {activeStores.map((store) => (
                <Menu.Item
                  key={store.id}
                  title={store.name}
                  onPress={() => {
                    setSelectedStoreId(store.id);
                    setStoreMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
          </View>

          <TextInput
            mode="outlined"
            label="Precio inicial"
            keyboardType="decimal-pad"
            value={initialPriceInput}
            onChangeText={setInitialPriceInput}
            outlineStyle={styles.inputOutline}
            placeholder="Ej: 120000"
          />
        </Card.Content>
      </Card>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pricingCard: {
    marginTop: 14,
    borderRadius: 12,
  },
  pricingCardContent: {
    gap: 12,
    paddingVertical: 6,
  },
  helperText: {
    color: '#5f6368',
  },
  fieldGroup: {
    gap: 6,
  },
  selectButton: {
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  selectButtonContent: {
    minHeight: 44,
    justifyContent: 'flex-start',
  },
  inputOutline: {
    borderRadius: 10,
  },
});
