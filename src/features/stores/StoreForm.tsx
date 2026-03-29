import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { StoreFormValues, storeSchema } from './schemas';

interface Props {
  defaultValues?: Partial<StoreFormValues>;
  onSubmit: (values: StoreFormValues) => Promise<void>;
  submitLabel?: string;
}

export const StoreForm = ({ defaultValues, onSubmit, submitLabel = 'Guardar tienda' }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<StoreFormValues>({
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      address: defaultValues?.address ?? '',
      phone: defaultValues?.phone ?? '',
      notes: defaultValues?.notes ?? '',
    },
  });

  return (
    <View style={{ gap: 12 }}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => <TextInput mode="outlined" label="Nombre" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => <TextInput mode="outlined" label="Descripcion" value={field.value ?? ''} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="address"
        render={({ field }) => <TextInput mode="outlined" label="Ubicacion" value={field.value ?? ''} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => <TextInput mode="outlined" label="Telefono" value={field.value ?? ''} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <TextInput mode="outlined" label="Notas" value={field.value ?? ''} onChangeText={field.onChange} multiline />}
      />
      {errors.name && <Text style={{ color: '#B00020' }}>{errors.name.message}</Text>}
      <Button mode="contained" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        {submitLabel}
      </Button>
    </View>
  );
};
