import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, useAppTheme } from '@/theme';

import { StoreFormValues, storeSchema } from './schemas';

interface Props {
  defaultValues?: Partial<StoreFormValues>;
  onSubmit: (values: StoreFormValues) => Promise<void>;
  submitLabel?: string;
}

export const StoreForm = ({ defaultValues, onSubmit, submitLabel = 'Guardar tienda' }: Props) => {
  const theme = useAppTheme();
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
      website: defaultValues?.website ?? '',
      email: defaultValues?.email ?? '',
      notes: defaultValues?.notes ?? '',
    },
  });

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
                label="Nombre"
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
          name="address"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Dirección"
              left={<TextInput.Icon icon="map-marker-outline" />}
              value={field.value ?? ''}
              onChangeText={field.onChange}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
            />
          )}
        />
        <Controller
          control={control}
          name="phone"
          render={({ field }) => (
            <TextInput
              mode="outlined"
              label="Teléfono"
              left={<TextInput.Icon icon="phone-outline" />}
              value={field.value ?? ''}
              onChangeText={field.onChange}
              keyboardType="phone-pad"
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
            />
          )}
        />
        <Controller
          control={control}
          name="website"
          render={({ field }) => (
            <View>
              <TextInput
                mode="outlined"
                label="Sitio web"
                left={<TextInput.Icon icon="web" />}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={Boolean(errors.website)}
                autoCapitalize="none"
                keyboardType="url"
                outlineStyle={styles.inputOutline}
                activeOutlineColor={theme.colors.accent}
              />
              {errors.website ? <HelperText type="error">{errors.website.message}</HelperText> : null}
            </View>
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <View>
              <TextInput
                mode="outlined"
                label="Email"
                left={<TextInput.Icon icon="email-outline" />}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                error={Boolean(errors.email)}
                autoCapitalize="none"
                keyboardType="email-address"
                outlineStyle={styles.inputOutline}
                activeOutlineColor={theme.colors.accent}
              />
              {errors.email ? <HelperText type="error">{errors.email.message}</HelperText> : null}
            </View>
          )}
        />
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
        {submitLabel}
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
  submitButton: { borderRadius: 12, marginTop: 2 },
  submitButtonContent: { minHeight: 48 },
  submitButtonLabel: { fontFamily: FONT_SANS_EXTRABOLD },
});
