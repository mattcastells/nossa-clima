import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAddQuoteServiceItem } from '@/features/quotes/hooks';
import { QuoteServiceItemFormValues, quoteServiceItemSchema } from '@/features/quotes/schemas';
import { useServices } from '@/features/services/hooks';

export default function AddServiceToQuotePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: services } = useServices();
  const add = useAddQuoteServiceItem();

  const { control, handleSubmit, watch, setValue } = useForm<QuoteServiceItemFormValues>({
    resolver: zodResolver(quoteServiceItemSchema),
    defaultValues: {
      quote_id: id,
      service_id: '',
      quantity: 1,
      unit_price: 0,
      notes: '',
    },
  });

  const selectedService = (services ?? []).find((service) => service.id === watch('service_id'));
  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');

  return (
    <AppScreen title="Agregar servicio">
      <View style={{ gap: 8 }}>
        <Controller
          control={control}
          name="service_id"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                const base = (services ?? []).find((s) => s.id === value)?.base_price ?? 0;
                setValue('unit_price', base);
              }}
              buttons={(services ?? []).filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name }))}
            />
          )}
        />
        <Text>Precio base sugerido: ${selectedService?.base_price ?? 0}</Text>
        <Controller
          control={control}
          name="quantity"
          render={({ field }) => (
            <TextInput mode="outlined" label="Cantidad" keyboardType="decimal-pad" value={String(field.value)} onChangeText={field.onChange} />
          )}
        />
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
          Agregar servicio
        </Button>
      </View>
    </AppScreen>
  );
}
