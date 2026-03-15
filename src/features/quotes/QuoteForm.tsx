import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { QuoteFormValues, quoteSchema } from './schemas';

interface Props {
  defaultValues?: Partial<QuoteFormValues>;
  onSubmit: (values: QuoteFormValues) => Promise<void>;
  buttonLabel?: string;
}

export const QuoteForm = ({ defaultValues, onSubmit, buttonLabel = 'Guardar trabajo' }: Props) => {
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
      notes: defaultValues?.notes ?? '',
    },
  });

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="client_name"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Cliente"
            placeholder="Ej. Juan Perez"
            value={field.value}
            onChangeText={field.onChange}
            outlineStyle={styles.inputOutline}
          />
        )}
      />
      <Controller
        control={control}
        name="client_phone"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Telefono"
            placeholder="Ej. 11 1234 5678"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            outlineStyle={styles.inputOutline}
          />
        )}
      />
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Titulo"
            placeholder="Ej. Instalacion aire acondicionado"
            value={field.value}
            onChangeText={field.onChange}
            outlineStyle={styles.inputOutline}
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
            placeholder="Detalles, observaciones o aclaraciones"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
            numberOfLines={3}
            outlineStyle={styles.inputOutline}
          />
        )}
      />
      <Button
        mode="contained"
        loading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
        style={styles.submitButton}
        contentStyle={styles.submitButtonContent}
      >
        {buttonLabel}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  inputOutline: {
    borderRadius: 10,
  },
  submitButton: {
    borderRadius: 10,
  },
  submitButtonContent: {
    minHeight: 42,
  },
});
