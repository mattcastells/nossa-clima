import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { StoreSelectorDialog } from '@/components/StoreSelectorDialog';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems, useSaveItem } from '@/features/items/hooks';
import { ItemFormValues, itemSchema } from '@/features/items/schemas';
import { useCreatePrice } from '@/features/prices/hooks';
import { useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { BRAND_GREEN, BRAND_GREEN_MID, useAppTheme } from '@/theme';

const parsePriceInput = (value: string): number | null => {
  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(parsed)) return Number.NaN;
  return parsed;
};

export default function NewItemPage() {
  const theme = useAppTheme();
  const chipBorderColor = theme.dark ? theme.colors.softGreenStrong : BRAND_GREEN_MID;
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
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: '',
      item_type: 'material',
      description: '',
      category: '',
      base_price_label: '',
      notes: '',
      sku: '',
    },
  });

  const [message, setMessage] = useState<string | null>(null);
  const [storeDialogVisible, setStoreDialogVisible] = useState(false);
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
        base_price_label: values.base_price_label?.trim() ? values.base_price_label.trim() : null,
        unit: 'mt',
        notes: values.notes?.trim() ? values.notes.trim() : null,
        brand: null,
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
                contentStyle={styles.inputContent}
                scrollEnabled
              />
            )}
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name.message}</Text> : null}

          <Controller
            control={control}
            name="base_price_label"
            render={({ field }) => (
              <TextInput
                mode="outlined"
                label="Referencia de calculo (kg)"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContent}
                scrollEnabled
                placeholder="Ej: Cobre"
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
                contentStyle={styles.inputContent}
                scrollEnabled
              />
            )}
          />

          {categorySuggestions.length > 0 && (
            <View style={styles.categorySuggestions}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>Categorias existentes</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {categorySuggestions.map((category) => {
                  const selected = currentCategory.toLowerCase() === category.toLowerCase();
                  const chipTextColor = theme.dark ? theme.colors.titleOnSoft : BRAND_GREEN;

                  return (
                    <Chip
                      key={category}
                      selected={selected}
                      selectedColor={chipTextColor}
                      style={StyleSheet.flatten([
                        styles.categoryChip,
                        {
                          backgroundColor: selected ? theme.colors.softGreenStrong : theme.colors.softGreen,
                          borderColor: chipBorderColor,
                        },
                      ])}
                      textStyle={StyleSheet.flatten([styles.categoryChipText, { color: chipTextColor }])}
                      onPress={() => setValue('category', category)}
                    >
                      {category}
                    </Chip>
                  );
                })}
              </ScrollView>
            </View>
          )}

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
                contentStyle={styles.inputContentMultiline}
              />
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <TextInput
                mode="outlined"
                label="Notas"
                value={field.value ?? ''}
                onChangeText={field.onChange}
                multiline
                numberOfLines={3}
                outlineStyle={styles.inputOutline}
                contentStyle={styles.inputContentMultiline}
              />
            )}
          />
        </Card.Content>
      </Card>

      <Card mode="outlined" style={styles.pricingCard}>
        <Card.Content style={styles.pricingCardContent}>
          <Text variant="titleSmall">Precio inicial (opcional)</Text>
          <Text style={styles.helperText}>Asocia el material a una tienda y registra su primer precio.</Text>

          <View style={styles.fieldGroup}>
            <Text variant="labelMedium">Tienda</Text>
            <Button
              mode="outlined"
              icon="table-search"
              onPress={() => setStoreDialogVisible(true)}
              style={styles.selectButton}
              contentStyle={styles.selectButtonContent}
              disabled={availableStores.length === 0}
            >
              {selectedStore?.name ?? (availableStores.length === 0 ? 'Sin tiendas disponibles' : 'Seleccionar tienda')}
            </Button>
          </View>

          <TextInput
            mode="outlined"
            label="Precio inicial"
            keyboardType="decimal-pad"
            value={initialPriceInput}
            onChangeText={setInitialPriceInput}
            outlineStyle={styles.inputOutline}
            contentStyle={styles.inputContent}
            scrollEnabled
            placeholder="Ej: 120000"
          />
        </Card.Content>
      </Card>

      <Button mode="contained" onPress={submit} loading={isBusy} disabled={isBusy} style={styles.saveButton} contentStyle={styles.saveButtonContent}>
        Guardar material
      </Button>

      <StoreSelectorDialog
        visible={storeDialogVisible}
        stores={availableStores}
        selectedStoreId={selectedStoreId || null}
        onSelect={(storeId) => setSelectedStoreId(storeId ?? '')}
        onDismiss={() => setStoreDialogVisible(false)}
        title="Seleccionar tienda para el material"
        allowNoStore
      />
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
  inputContent: {
    paddingHorizontal: 10,
  },
  inputContentMultiline: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  categorySuggestions: {
    gap: 8,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryChipText: {
    fontWeight: '500',
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
