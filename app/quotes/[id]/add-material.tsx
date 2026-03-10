import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useItems } from '@/features/items/hooks';
import { useAddQuoteMaterialItem, useSuggestedMaterialPrice } from '@/features/quotes/hooks';
import { QuoteMaterialItemFormValues, quoteMaterialItemSchema } from '@/features/quotes/schemas';
import { useStores } from '@/features/stores/hooks';

export default function AddMaterialToQuotePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: items } = useItems();
  const { data: stores } = useStores();
  const add = useAddQuoteMaterialItem();

  const { control, handleSubmit, watch, setValue } = useForm<QuoteMaterialItemFormValues>({
    resolver: zodResolver(quoteMaterialItemSchema),
    defaultValues: {
      quote_id: id,
      item_id: '',
      quantity: 1,
      unit_price: 0,
      margin_percent: null,
      source_store_id: null,
      unit: '',
      notes: '',
    },
  });

  const selectedItemId = watch('item_id');
  const marginPercent = watch('margin_percent');
  const sourceStoreId = watch('source_store_id');
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');

  const suggestion = useSuggestedMaterialPrice(selectedItemId, marginPercent, sourceStoreId);

  return (
    <AppScreen title="Agregar material">
      <View style={{ gap: 8 }}>
        <Controller
          control={control}
          name="item_id"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={(items ?? []).filter((i) => i.is_active).map((i) => ({ value: i.id, label: i.name }))}
            />
          )}
        />
        <Controller
          control={control}
          name="source_store_id"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value ?? ''}
              onValueChange={(value) => field.onChange(value || null)}
              buttons={[
                { value: '', label: 'Sin tienda' },
                ...((stores ?? []).filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name })) ?? []),
              ]}
            />
          )}
        />
        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <TextInput mode="outlined" label="Cantidad" keyboardType="decimal-pad" value={String(field.value)} onChangeText={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="margin_percent"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Margen % (opcional)"
              keyboardType="decimal-pad"
              value={field.value == null ? '' : String(field.value)}
              onChangeText={(value) => field.onChange(value ? Number(value) : null)}
            />
          )}
        />
        <Button
          mode="outlined"
          onPress={() => {
            setValue('unit_price', suggestion.data?.suggestedUnitPrice ?? 0);
          }}
        >
          Usar precio sugerido
        </Button>
        <Text>Costo base detectado: ${suggestion.data?.baseCost ?? 0}</Text>
        <Controller
          control={control}
          name="unit_price"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Precio unitario"
              keyboardType="decimal-pad"
              value={String(field.value)}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="notes"
          render={({ field }) => <TextInput mode="outlined" label="Notas" value={field.value} onChangeText={field.onChange} />}
        />

        <Text variant="titleMedium">Total estimado: ${(Number(quantity) || 0) * (Number(unitPrice) || 0)}</Text>

        <Button
          mode="contained"
          onPress={handleSubmit(async (values) => {
            await add.mutateAsync(values);
            router.back();
          })}
        >
          Agregar material
        </Button>
      </View>
    </AppScreen>
  );
}
