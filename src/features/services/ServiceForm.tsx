import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';

import { BRAND_BLUE, BRAND_BLUE_MID, useAppTheme } from '@/theme';

import { ServiceFormValues, serviceSchema } from './schemas';

interface Props {
  defaultValues?: Partial<ServiceFormValues>;
  categorySuggestions?: string[];
  onSubmit: (values: ServiceFormValues) => Promise<void>;
}

export const ServiceForm = ({ defaultValues, categorySuggestions = [], onSubmit }: Props) => {
  const theme = useAppTheme();
  const chipTextColor = theme.dark ? theme.colors.titleOnSoft : BRAND_BLUE;
  const chipBorderColor = theme.dark ? theme.colors.softBlueStrong : BRAND_BLUE_MID;
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      description: defaultValues?.description ?? '',
      category: defaultValues?.category ?? '',
      unit_type: defaultValues?.unit_type ?? '',
      base_price: defaultValues?.base_price ?? 0,
    },
  });

  const selectedCategory = watch('category')?.trim() ?? '';

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="name"
        render={({ field }) => <TextInput mode="outlined" label="Nombre" value={field.value} onChangeText={field.onChange} />}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextInput mode="outlined" label="Descripcion" value={field.value ?? ''} onChangeText={field.onChange} multiline numberOfLines={3} />
        )}
      />
      <Controller
        control={control}
        name="category"
        render={({ field }) => <TextInput mode="outlined" label="Categoria" value={field.value ?? ''} onChangeText={field.onChange} />}
      />
      {categorySuggestions.length > 0 && (
        <View style={styles.categorySuggestions}>
          <Text variant="labelMedium" style={{ color: theme.colors.onSurface }}>Categorias disponibles</Text>
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
                      backgroundColor: selected ? theme.colors.softBlueStrong : theme.colors.softBlue,
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
        render={({ field }) => <TextInput mode="outlined" label="Unidad de trabajo (opcional)" value={field.value ?? ''} onChangeText={field.onChange} />}
      />
      {errors.name && <Text style={{ color: '#B00020' }}>{errors.name.message}</Text>}
      <Button mode="contained" loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        Guardar servicio
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: 12,
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
});
