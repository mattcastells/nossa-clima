import { forwardRef, useEffect, useImperativeHandle, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, TextInput } from 'react-native-paper';

import { QuoteFormValues, quoteSchema } from './schemas';

interface Props {
  defaultValues?: Partial<QuoteFormValues>;
  onSubmit: (values: QuoteFormValues) => Promise<void>;
  buttonLabel?: string;
  disabled?: boolean;
  extraContent?: ReactNode;
  /** Oculta el botón propio cuando quien contiene el form ya ofrece uno. */
  hideSubmitButton?: boolean;
}

/** Permite guardar el formulario desde afuera (ver el "Guardar trabajo" del detalle). */
export interface QuoteFormHandle {
  submit: () => Promise<void>;
}

export const QuoteForm = forwardRef<QuoteFormHandle, Props>(function QuoteForm(
  { defaultValues, onSubmit, buttonLabel = 'Guardar trabajo', disabled = false, extraContent, hideSubmitButton = false },
  ref,
) {
  const clientName = defaultValues?.client_name ?? '';
  const clientPhone = defaultValues?.client_phone ?? '';
  const title = defaultValues?.title ?? '';
  const description = defaultValues?.description ?? '';
  const notes = defaultValues?.notes ?? '';
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_name: clientName,
      client_phone: clientPhone,
      title,
      description,
      notes,
    },
  });

  useEffect(() => {
    reset({
      client_name: clientName,
      client_phone: clientPhone,
      title,
      description,
      notes,
    });
  }, [clientName, clientPhone, description, notes, reset, title]);

  useImperativeHandle(ref, () => ({ submit: () => handleSubmit(onSubmit)() }), [handleSubmit, onSubmit]);

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
            disabled={disabled}
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
            disabled={disabled}
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
            disabled={disabled}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Domicilio"
            placeholder="Ej. Av. San Martín 1200, Piso 2"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            outlineStyle={styles.inputOutline}
            disabled={disabled}
          />
        )}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Trabajo realizado / notas"
            placeholder="Qué se detectó, qué se hizo y recomendaciones"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
            numberOfLines={3}
            outlineStyle={styles.inputOutline}
            disabled={disabled}
          />
        )}
      />
      {extraContent}
      {hideSubmitButton ? null : (
        <Button
          mode="contained"
          loading={isSubmitting}
          disabled={disabled || isSubmitting}
          onPress={handleSubmit(onSubmit)}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
        >
          {buttonLabel}
        </Button>
      )}
    </View>
  );
});

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
