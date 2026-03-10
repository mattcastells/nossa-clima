import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Switch, View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { ServiceFormValues, serviceSchema } from './schemas';

interface Props {
  defaultValues?: Partial<ServiceFormValues>;
  onSubmit: (values: ServiceFormValues) => Promise<void>;
}

export const ServiceForm = ({ defaultValues, onSubmit }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      category: defaultValues?.category ?? '',
      base_price: defaultValues?.base_price ?? 0,
      unit_type: defaultValues?.unit_type ?? '',
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
        name="description"
        render={({ field }) => <TextInput mode="outlined" label="Descripción" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="category"
        render={({ field }) => <TextInput mode="outlined" label="Categoría" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="base_price"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Precio base"
            keyboardType="decimal-pad"
            value={String(field.value)}
            onChangeText={field.onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="unit_type"
        render={({ field }) => <TextInput mode="outlined" label="Tipo de unidad" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="is_active"
        render={({ field }) => (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>Activo</Text>
            <Switch value={field.value} onValueChange={field.onChange} />
          </View>
        )}
      />
      {errors.name && <Text style={{ color: '#B00020' }}>{errors.name.message}</Text>}
      <Button mode="contained" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        Guardar servicio
      </Button>
    </View>
  );
};
