import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Switch, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { StoreFormValues, storeSchema } from './schemas';

interface Props {
  defaultValues?: Partial<StoreFormValues>;
  onSubmit: (values: StoreFormValues) => Promise<void>;
}

export const StoreForm = ({ defaultValues, onSubmit }: Props) => {
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
      is_active: defaultValues?.is_active ?? true,
    },
  });

  return (
    <View style={{ gap: 8 }}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => <TextInput mode="outlined" label="Nombre" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="address"
        render={({ field }) => <TextInput mode="outlined" label="Dirección" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => <TextInput mode="outlined" label="Teléfono" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="notes"
        render={({ field }) => <TextInput mode="outlined" label="Notas" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="is_active"
        render={({ field }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>Activa</Text>
            <Switch value={field.value} onValueChange={field.onChange} />
          </View>
        )}
      />
      {errors.name && <Text style={{ color: '#B00020' }}>{errors.name.message}</Text>}
      <Button mode="contained" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        Guardar
      </Button>
    </View>
  );
};
