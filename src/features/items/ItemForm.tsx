import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { getCategoryAccent } from '@/features/items/categoryAccent';
import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, useAppTheme } from '@/theme';

import { ItemFormValues, itemSchema } from './schemas';

interface Props {
  defaultValues?: Partial<ItemFormValues>;
  categorySuggestions?: string[];
  onSubmit: (values: ItemFormValues) => Promise<void>;
}

export const ItemForm = ({ defaultValues, categorySuggestions = [], onSubmit }: Props) => {
  const theme = useAppTheme();
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
      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <View>
              <TextInput
                mode="outlined"
                label="Nombre del material"
                value={field.value}
                onChangeText={field.onChange}
                error={Boolean(errors.name)}
                outlineStyle={styles.inputOutline}
                activeOutlineColor={theme.colors.accent}
              />
              {errors.name ? <HelperText type="error">{errors.name.message}</HelperText> : null}
            </View>
          )}
        />

        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Categoría"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
            />
          )}
        />

        {categorySuggestions.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {categorySuggestions.map((category) => {
              const selected = selectedCategory.toLowerCase() === category.toLowerCase();
              const accent = getCategoryAccent(theme, category);

              return (
                <Pressable
                  key={category}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setValue('category', selected ? '' : category)}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    { backgroundColor: accent.backgroundColor, borderColor: selected ? accent.textColor : 'transparent' },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.categoryChipText, { color: accent.textColor }]}>{category}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
        <Text style={[styles.sectionLabel, { color: theme.colors.textMuted }]}>DETALLE</Text>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Descripción"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              multiline
              numberOfLines={3}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
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
              value={field.value ?? ''}
              onChangeText={field.onChange}
              multiline
              numberOfLines={3}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
            />
          )}
        />
      </View>

      <Button
        mode="contained"
        loading={isSubmitting}
        disabled={isSubmitting}
        onPress={handleSubmit(onSubmit)}
        buttonColor={theme.colors.accent}
        textColor={theme.colors.onAccent}
        style={styles.submitButton}
        contentStyle={styles.submitButtonContent}
        labelStyle={styles.submitButtonLabel}
      >
        Guardar material
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  form: { gap: 12 },
  section: {
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: FONT_SANS_BOLD,
    letterSpacing: 0.8,
  },
  inputOutline: { borderRadius: 12 },
  chipsRow: { gap: 8, paddingVertical: 2 },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  categoryChipText: { fontSize: 13, fontFamily: FONT_SANS_BOLD },
  pressed: { opacity: 0.8 },
  submitButton: { borderRadius: 12, marginTop: 2 },
  submitButtonContent: { minHeight: 48 },
  submitButtonLabel: { fontFamily: FONT_SANS_EXTRABOLD },
});
