import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';

import { BRAND_GREEN, BRAND_GREEN_MID, useAppTheme } from '@/theme';

import { ItemFormValues, itemSchema } from './schemas';

interface Props {
  defaultValues?: Partial<ItemFormValues>;
  categorySuggestions?: string[];
  onSubmit: (values: ItemFormValues) => Promise<void>;
}

export const ItemForm = ({ defaultValues, categorySuggestions = [], onSubmit }: Props) => {
  const theme = useAppTheme();
  const chipTextColor = theme.dark ? theme.colors.titleOnSoft : BRAND_GREEN;
  const chipBorderColor = theme.dark ? theme.colors.softGreenStrong : BRAND_GREEN_MID;
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      item_type: 'material',
      category: defaultValues?.category ?? '',
      base_price_label: defaultValues?.base_price_label ?? '',
      description: defaultValues?.description ?? '',
      notes: defaultValues?.notes ?? '',
      sku: defaultValues?.sku ?? '',
    },
  });

  const selectedCategory = watch('category')?.trim() ?? '';

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextInput mode="outlined" label="Nombre del material" value={field.value} onChangeText={field.onChange} outlineStyle={styles.inputOutline} />
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Descripcion"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
            numberOfLines={3}
            outlineStyle={styles.inputOutline}
          />
        )}
      />

      <Controller
        control={control}
        name="category"
        render={({ field }) => (
          <TextInput mode="outlined" label="Categoria" value={field.value ?? ''} onChangeText={field.onChange} outlineStyle={styles.inputOutline} />
        )}
      />

      {categorySuggestions.length > 0 && (
        <View style={styles.categorySuggestions}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>Categorias existentes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {categorySuggestions.map((category) => {
              const selected = selectedCategory.toLowerCase() === category.toLowerCase();

              return (
                <Chip
                  key={category}
                  selected={selected}
                  selectedColor={chipTextColor}
                  textStyle={StyleSheet.flatten([styles.categoryChipText, { color: chipTextColor }])}
                  style={StyleSheet.flatten([
                    styles.categoryChip,
                    {
                      backgroundColor: selected ? theme.colors.softGreenStrong : theme.colors.softGreen,
                      borderColor: chipBorderColor,
                    },
                  ])}
                  onPress={() => setValue('category', category)}
                >
                  {category}
                </Chip>
              );
            })}
          </ScrollView>
        </View>
      )}

      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Notas"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            multiline
            numberOfLines={3}
            outlineStyle={styles.inputOutline}
          />
        )}
      />

      {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}

      <Button mode="contained" loading={isSubmitting} onPress={handleSubmit(onSubmit)} style={styles.submitButton} contentStyle={styles.submitButtonContent}>
        Guardar material
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
  categorySuggestions: {
    gap: 8,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
  },
  categoryChipText: {
    fontWeight: '500',
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
