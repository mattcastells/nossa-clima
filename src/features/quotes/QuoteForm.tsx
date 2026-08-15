import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Icon, Text, TextInput } from 'react-native-paper';

import { useClientDirectory } from '@/features/quotes/hooks';
import { normalizeClientName, type ClientDirectoryEntry } from '@/services/quotes';
import { FONT_SANS_BOLD, useAppTheme } from '@/theme';

import { QuoteFormValues, quoteSchema } from './schemas';

/** Cuantas sugerencias de cliente se muestran a la vez. */
const MAX_CLIENT_SUGGESTIONS = 4;

interface Props {
  defaultValues?: Partial<QuoteFormValues>;
  onSubmit: (values: QuoteFormValues) => Promise<void>;
  buttonLabel?: string;
  disabled?: boolean;
  extraContent?: ReactNode;
  /** Oculta el botón propio cuando quien contiene el form ya ofrece uno. */
  hideSubmitButton?: boolean;
}

/** Permite guardar el formulario desde afuera (ver el "Guardar trabajo" del detalle). */
export interface QuoteFormHandle {
  submit: () => Promise<void>;
}

export const QuoteForm = forwardRef<QuoteFormHandle, Props>(function QuoteForm(
  { defaultValues, onSubmit, buttonLabel = 'Guardar trabajo', disabled = false, extraContent, hideSubmitButton = false },
  ref,
) {
  const theme = useAppTheme();
  const clientName = defaultValues?.client_name ?? '';
  const clientPhone = defaultValues?.client_phone ?? '';
  const title = defaultValues?.title ?? '';
  const description = defaultValues?.description ?? '';
  const technicianName = defaultValues?.technician_name ?? '';
  const clientNotes = defaultValues?.client_notes ?? '';
  const notes = defaultValues?.notes ?? '';
  const technicianNotes = defaultValues?.technician_notes ?? '';

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_name: clientName,
      client_phone: clientPhone,
      title,
      description,
      technician_name: technicianName,
      client_notes: clientNotes,
      notes,
      technician_notes: technicianNotes,
    },
  });

  useEffect(() => {
    reset({
      client_name: clientName,
      client_phone: clientPhone,
      title,
      description,
      technician_name: technicianName,
      client_notes: clientNotes,
      notes,
      technician_notes: technicianNotes,
    });
  }, [clientName, clientNotes, clientPhone, description, notes, reset, technicianName, technicianNotes, title]);

  useImperativeHandle(ref, () => ({ submit: () => handleSubmit(onSubmit)() }), [handleSubmit, onSubmit]);

  // ── Sugerencias de cliente ─────────────────────────────────────────────
  // Salen de los trabajos ya cargados. Al elegir una se completan teléfono y
  // domicilio, con shouldDirty para que el "Guardar trabajo" del detalle las
  // tome.
  const { data: clientDirectory } = useClientDirectory();
  const [clientFieldFocused, setClientFieldFocused] = useState(false);
  const currentClientName = watch('client_name') ?? '';

  const clientSuggestions = useMemo(() => {
    if (!clientFieldFocused) return [];
    const query = normalizeClientName(currentClientName);
    const entries = clientDirectory ?? [];
    // Con el campo vacío se ofrecen los clientes con más trabajos: es el atajo
    // útil al empezar un trabajo nuevo.
    if (!query) {
      return entries.slice().sort((a, b) => b.jobCount - a.jobCount).slice(0, MAX_CLIENT_SUGGESTIONS);
    }
    // Ya está elegido exacto: no hay nada que sugerir.
    if (entries.some((entry) => entry.id === query)) return [];
    return entries.filter((entry) => entry.id.includes(query)).slice(0, MAX_CLIENT_SUGGESTIONS);
  }, [clientDirectory, clientFieldFocused, currentClientName]);

  const applyClientSuggestion = (entry: ClientDirectoryEntry) => {
    setValue('client_name', entry.name, { shouldDirty: true, shouldValidate: true });
    if (entry.phone) setValue('client_phone', entry.phone, { shouldDirty: true });
    if (entry.address) setValue('description', entry.address, { shouldDirty: true });
    setClientFieldFocused(false);
  };

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="client_name"
        render={({ field }) => (
          <View style={styles.clientBlock}>
            <TextInput
              mode="outlined"
              label="Cliente"
              placeholder="Ej. Juan Perez"
              value={field.value}
              onChangeText={field.onChange}
              onFocus={() => setClientFieldFocused(true)}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
              disabled={disabled}
            />
            {clientSuggestions.length > 0 ? (
              <View style={[styles.suggestions, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
                {clientSuggestions.map((entry) => (
                  <Pressable
                    key={entry.id}
                    accessibilityRole="button"
                    onPress={() => applyClientSuggestion(entry)}
                    disabled={disabled}
                    style={({ pressed }) => [styles.suggestionRow, pressed && styles.suggestionRowPressed]}
                  >
                    <Icon source="account-outline" size={18} color={theme.colors.accentStrong} />
                    <View style={styles.suggestionInfo}>
                      <Text style={[styles.suggestionName, { color: theme.colors.titleOnSoft }]} numberOfLines={1}>
                        {entry.name}
                      </Text>
                      {entry.phone || entry.address ? (
                        <Text style={[styles.suggestionMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                          {[entry.phone, entry.address].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        )}
      />
      <Controller
        control={control}
        name="client_phone"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Telefono"
            placeholder="Ej. 11 1234 5678"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            keyboardType="phone-pad"
            outlineStyle={styles.inputOutline}
            activeOutlineColor={theme.colors.accent}
            disabled={disabled}
          />
        )}
      />
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Titulo"
            placeholder="Ej. Instalacion aire acondicionado"
            value={field.value}
            onChangeText={field.onChange}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={theme.colors.accent}
            disabled={disabled}
          />
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Domicilio"
            placeholder="Ej. Av. San Martín 1200, Piso 2"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={theme.colors.accent}
            disabled={disabled}
          />
        )}
      />
      <Controller
        control={control}
        name="technician_name"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Técnico encargado"
            placeholder="Quién hace el trabajo"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={theme.colors.accent}
            disabled={disabled}
          />
        )}
      />
      <Controller
        control={control}
        name="client_notes"
        render={({ field }) => (
          <TextInput
            mode="outlined"
            label="Datos de acceso"
            placeholder="Timbre, piso, quién recibe si no está"
            value={field.value ?? ''}
            onChangeText={field.onChange}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={theme.colors.accent}
            disabled={disabled}
          />
        )}
      />

      <View style={[styles.notesDivider, { backgroundColor: theme.colors.borderSoft }]} />

      <Controller
        control={control}
        name="notes"
        render={({ field }) => (
          <View style={styles.notesField}>
            <TextInput
              mode="outlined"
              label="Notas para el informe"
              placeholder="Qué se detectó, qué se hizo y recomendaciones"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              multiline
              numberOfLines={4}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
              disabled={disabled}
            />
            <View style={styles.notesHintRow}>
              <Icon source="file-document-outline" size={14} color={theme.colors.accentStrong} />
              <Text style={[styles.notesHint, { color: theme.colors.textMuted }]}>Sale en el PDF.</Text>
            </View>
          </View>
        )}
      />
      <Controller
        control={control}
        name="technician_notes"
        render={({ field }) => (
          <View style={styles.notesField}>
            <TextInput
              mode="outlined"
              label="Notas para el técnico"
              placeholder="Recordatorios para vos: herramientas, avisos, pendientes"
              value={field.value ?? ''}
              onChangeText={field.onChange}
              multiline
              numberOfLines={3}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
              disabled={disabled}
            />
            <View style={styles.notesHintRow}>
              <Icon source="eye-off-outline" size={14} color={theme.colors.textMuted} />
              <Text style={[styles.notesHint, { color: theme.colors.textMuted }]}>
                No sale en el PDF. Se ve en la agenda y en el aviso del turno.
              </Text>
            </View>
          </View>
        )}
      />
      {extraContent}
      {hideSubmitButton ? null : (
        <Button
          mode="contained"
          loading={isSubmitting}
          disabled={disabled || isSubmitting}
          onPress={handleSubmit(onSubmit)}
          style={styles.submitButton}
          contentStyle={styles.submitButtonContent}
        >
          {buttonLabel}
        </Button>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  form: {
    gap: 14,
  },
  inputOutline: {
    borderRadius: 10,
  },
  clientBlock: {
    gap: 6,
  },
  suggestions: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  suggestionRowPressed: {
    opacity: 0.7,
  },
  suggestionInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  suggestionName: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FONT_SANS_BOLD,
  },
  suggestionMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  notesDivider: {
    height: 1,
    marginVertical: 2,
  },
  notesField: {
    gap: 5,
  },
  notesHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
  },
  notesHint: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  submitButton: {
    borderRadius: 10,
  },
  submitButtonContent: {
    minHeight: 42,
  },
});
