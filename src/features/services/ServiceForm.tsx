import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';
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
      base_price: defaultValues?.base_price ?? 0,
      is_active: defaultValues?.is_active ?? true,
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
      {errors.name && <Text style={{ color: '#B00020' }}>{errors.name.message}</Text>}
      <Button mode="contained" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        Guardar servicio
      </Button>
    </View>
  );
};
