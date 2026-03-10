import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, Menu, Text, TextInput } from 'react-native-paper';

import { ItemFormValues, itemSchema } from './schemas';

interface Props {
  defaultValues?: Partial<ItemFormValues>;
  onSubmit: (values: ItemFormValues) => Promise<void>;
}

const ITEM_TYPE_OPTIONS: Array<{ value: ItemFormValues['item_type']; label: string }> = [
  { value: 'product', label: 'Producto' },
  { value: 'tool', label: 'Herramienta' },
  { value: 'material', label: 'Material' },
  { value: 'other', label: 'Otro' },
];

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

  const [itemTypeMenuVisible, setItemTypeMenuVisible] = useState(false);

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextInput mode="outlined" label="Nombre" value={field.value} onChangeText={field.onChange} outlineStyle={styles.inputOutline} />
        )}
      />
      <Controller
        control={control}
        name="item_type"
        render={({ field }) => {
          const selectedOption =
            ITEM_TYPE_OPTIONS.find((option) => option.value === field.value) ??
            ({
              value: 'product',
              label: 'Producto',
            } as const);
          return (
            <View style={styles.fieldGroup}>
              <Text variant="labelMedium">Tipo de item</Text>
              <Menu
                visible={itemTypeMenuVisible}
                onDismiss={() => setItemTypeMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    icon="chevron-down"
                    onPress={() => setItemTypeMenuVisible(true)}
                    style={styles.selectButton}
                    contentStyle={styles.selectButtonContent}
                  >
                    {selectedOption.label}
                  </Button>
                }
              >
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <Menu.Item
                    key={option.value}
                    title={option.label}
                    onPress={() => {
                      field.onChange(option.value);
                      setItemTypeMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>
            </View>
          );
        }}
      />
      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <TextInput mode="outlined" label="Categoria" value={field.value ?? ''} onChangeText={field.onChange} outlineStyle={styles.inputOutline} />
        )}
      />
      <Controller
        control={control}
        name="unit"
        render={({ field }) => (
          <TextInput mode="outlined" label="Unidad" value={field.value ?? ''} onChangeText={field.onChange} outlineStyle={styles.inputOutline} />
        )}
      />
      <Controller
        control={control}
        name="brand"
        render={({ field }) => (
          <TextInput mode="outlined" label="Marca" value={field.value ?? ''} onChangeText={field.onChange} outlineStyle={styles.inputOutline} />
        )}
      />
      {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}
      <Button mode="contained" loading={isSubmitting} onPress={handleSubmit(onSubmit)} style={styles.submitButton} contentStyle={styles.submitButtonContent}>
        Guardar
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  inputOutline: {
    borderRadius: 10,
  },
  selectButton: {
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  selectButtonContent: {
    minHeight: 46,
    justifyContent: 'flex-start',
  },
  submitButton: {
    borderRadius: 10,
    marginTop: 2,
  },
  submitButtonContent: {
    minHeight: 42,
  },
  errorText: {
    color: '#B00020',
  },
});
