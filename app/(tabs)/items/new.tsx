import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Menu, Text, TextInput } from 'react-native-paper';
import { z } from 'zod';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems, useSaveItem } from '@/features/items/hooks';
import { useCreatePrice } from '@/features/prices/hooks';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';

const newMaterialSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio'),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
});

type NewMaterialValues = z.infer<typeof newMaterialSchema>;

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
  const { data: items } = useItems();
  const { data: stores, isLoading: storesLoading, error: storesError } = useStores();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewMaterialValues>({
    resolver: zodResolver(newMaterialSchema),
    defaultValues: {
      name: '',
      description: '',
      category: '',
    },
  });

  const [message, setMessage] = useState<string | null>(null);
  const [storeMenuVisible, setStoreMenuVisible] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [initialPriceInput, setInitialPriceInput] = useState('');
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));

  const availableStores = useMemo(() => stores ?? [], [stores]);
  const selectedStore = availableStores.find((store) => store.id === selectedStoreId) ?? null;
  const categorySuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          (items ?? [])
            .filter((item) => item.item_type === 'material')
            .map((item) => item.category?.trim() ?? '')
            .filter((category) => category.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const currentCategory = watch('category')?.trim() ?? '';

  const submit = handleSubmit(async (values) => {
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
        name: values.name.trim(),
        item_type: 'material',
        category: values.category?.trim() ? values.category.trim() : null,
        description: values.description?.trim() ? values.description.trim() : null,
      });

      if (selectedStoreId && parsedPrice != null) {
        await createPrice.mutateAsync({
          store_id: selectedStoreId,
          item_id: createdItem.id,
          price: parsedPrice,
          currency: 'ARS',
          observed_at: new Date().toISOString(),
          source_type: 'manual_update',
          quantity_reference: null,
          notes: 'Precio inicial del material',
        });
      }

      toast.success('Material guardado.');
      router.back();
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo guardar el material.'));
    }
  });

  const isBusy = save.isPending || createPrice.isPending;

  return (
    <AppScreen title="Nuevo material">
      <LoadingOrError isLoading={storesLoading} error={storesError ? new Error(storesError.message) : null} />

      <Card mode="outlined" style={styles.formCard}>
        <Card.Content style={styles.formCardContent}>
          <Controller
            control={control}
            name="name"
            render={({ field }) => (
              <TextInput
                mode="outlined"
                label="Nombre del material"
                value={field.value}
                onChangeText={field.onChange}
                outlineStyle={styles.inputOutline}
              />
            )}
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name.message}</Text> : null}

          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <TextInput
                mode="outlined"
                label="Descripcion"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                multiline
                numberOfLines={3}
                outlineStyle={styles.inputOutline}
              />
            )}
          />

          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <TextInput
                mode="outlined"
                label="Categoria"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                outlineStyle={styles.inputOutline}
              />
            )}
          />

          {categorySuggestions.length > 0 && (
            <View style={styles.categorySuggestions}>
              <Text variant="labelMedium">Categorias existentes</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {categorySuggestions.map((category) => (
                  <Chip
                    key={category}
                    selected={currentCategory.toLowerCase() === category.toLowerCase()}
                    onPress={() => setValue('category', category)}
                  >
                    {category}
                  </Chip>
                ))}
              </ScrollView>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.pricingCard}>
        <Card.Content style={styles.pricingCardContent}>
          <Text variant="titleSmall">Precio inicial (opcional)</Text>
          <Text style={styles.helperText}>Asocia el material a una tienda y registra su primer precio.</Text>

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
                  disabled={availableStores.length === 0}
                >
                  {selectedStore?.name ?? (availableStores.length === 0 ? 'Sin tiendas disponibles' : 'Seleccionar tienda')}
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
              {availableStores.map((store) => (
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

      <Button mode="contained" onPress={submit} loading={isBusy} disabled={isBusy} style={styles.saveButton} contentStyle={styles.saveButtonContent}>
        Guardar material
      </Button>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderRadius: 12,
  },
  formCardContent: {
    gap: 12,
    paddingVertical: 8,
  },
  pricingCard: {
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
  categorySuggestions: {
    gap: 8,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  saveButton: {
    borderRadius: 10,
  },
  saveButtonContent: {
    minHeight: 44,
  },
  errorText: {
    color: '#B00020',
  },
});
