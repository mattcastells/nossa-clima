import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button, SegmentedButtons, TextInput } from 'react-native-paper';

import { QuoteFormValues, quoteSchema } from './schemas';

interface Props {
  defaultValues?: Partial<QuoteFormValues>;
  onSubmit: (values: QuoteFormValues) => Promise<void>;
  buttonLabel?: string;
}

export const QuoteForm = ({ defaultValues, onSubmit, buttonLabel = 'Guardar presupuesto' }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_name: defaultValues?.client_name ?? '',
      client_phone: defaultValues?.client_phone ?? '',
      title: defaultValues?.title ?? '',
      description: defaultValues?.description ?? '',
      notes: defaultValues?.notes ?? '',
      status: defaultValues?.status ?? 'draft',
    },
  });

  return (
    <View style={{ gap: 8 }}>
      <Controller
        control={control}
        name="client_name"
        render={({ field }) => <TextInput mode="outlined" label="Cliente" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="client_phone"
        render={({ field }) => <TextInput mode="outlined" label="Teléfono" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="title"
        render={({ field }) => <TextInput mode="outlined" label="Título" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => <TextInput mode="outlined" label="Descripción" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <TextInput mode="outlined" label="Notas" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <SegmentedButtons
            value={field.value}
            onValueChange={field.onChange}
            buttons={[
              { value: 'draft', label: 'Borrador' },
              { value: 'sent', label: 'Enviado' },
              { value: 'approved', label: 'Aprobado' },
              { value: 'rejected', label: 'Rechazado' },
            ]}
          />
        )}
      />
      <Button mode="contained" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        {buttonLabel}
      </Button>
    </View>
  );
};
