import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { QuoteServiceItemFormValues, quoteServiceItemSchema } from '../schemas';

interface Props {
  defaultValues: QuoteServiceItemFormValues;
  onSubmit: (values: QuoteServiceItemFormValues) => Promise<void>;
  submitLabel: string;
}

export const QuoteServiceItemForm = ({ defaultValues, onSubmit, submitLabel }: Props) => {
  const { control, handleSubmit, watch } = useForm<QuoteServiceItemFormValues>({
    resolver: zodResolver(quoteServiceItemSchema),
    defaultValues,
  });

  const quantity = watch('quantity');
  const unitPrice = watch('unit_price');

  return (
    <View style={{ gap: 8 }}>
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
          <TextInput mode="outlined" label="Precio unitario" keyboardType="decimal-pad" value={String(field.value)} onChangeText={field.onChange} />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <TextInput mode="outlined" label="Notas" value={field.value} onChangeText={field.onChange} />}
      />
      <Text>Total preview: ${(Number(quantity) || 0) * (Number(unitPrice) || 0)}</Text>
      <Button mode="contained" onPress={handleSubmit(onSubmit)}>
        {submitLabel}
      </Button>
    </View>
  );
};
