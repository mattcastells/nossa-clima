import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Switch, View } from 'react-native';
import { Button, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { ItemFormValues, itemSchema } from './schemas';

interface Props {
  defaultValues?: Partial<ItemFormValues>;
  onSubmit: (values: ItemFormValues) => Promise<void>;
}

export const ItemForm = ({ defaultValues, onSubmit }: Props) => {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      item_type: defaultValues?.item_type ?? 'product',
      category: defaultValues?.category ?? '',
      unit: defaultValues?.unit ?? '',
      brand: defaultValues?.brand ?? '',
      sku: defaultValues?.sku ?? '',
      description: defaultValues?.description ?? '',
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
        name="item_type"
        render={({ field }) => (
          <SegmentedButtons
            value={field.value}
            onValueChange={field.onChange}
            buttons={[
              { value: 'product', label: 'Producto' },
              { value: 'tool', label: 'Herramienta' },
              { value: 'material', label: 'Material' },
              { value: 'other', label: 'Otro' },
            ]}
          />
        )}
      />
      <Controller
        control={control}
        name="category"
        render={({ field }) => <TextInput mode="outlined" label="Categoría" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="unit"
        render={({ field }) => <TextInput mode="outlined" label="Unidad" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="brand"
        render={({ field }) => <TextInput mode="outlined" label="Marca" value={field.value} onChangeText={field.onChange} />}
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
        Guardar
      </Button>
    </View>
  );
};
