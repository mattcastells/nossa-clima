import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { quoteStatusAccent } from '@/features/quotes/status';
import { FONT_SANS_BOLD, useAppTheme } from '@/theme';
import type { JobQuoteStatus } from '@/types/db';

export const QUOTE_STATUS_OPTIONS: Array<{ value: JobQuoteStatus; label: string }> = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'completed', label: 'Terminado' },
  { value: 'cancelled', label: 'Cancelado' },
];

interface Props {
  current: JobQuoteStatus;
  onChange: (next: JobQuoteStatus) => void;
  disabled?: boolean;
}

/**
 * Fila de estado del trabajo. Se muestra dos veces en el detalle: arriba de
 * todo (es lo primero que se toca al abrir el trabajo, y además es lo que
 * desbloquea la edición) y al pie, donde estaba antes.
 */
export function QuoteStatusSelector({ current, onChange, disabled = false }: Props) {
  const theme = useAppTheme();

  return (
    <View style={styles.row}>
      {QUOTE_STATUS_OPTIONS.map((option) => {
        const accent = quoteStatusAccent(option.value);
        const selected = current === option.value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
              selected && {
                backgroundColor: accent.backgroundColor,
                borderColor: accent.borderColor,
                borderWidth: 2,
              },
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: theme.colors.textMuted },
                selected && { color: accent.textColor },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    flex: 1,
    minWidth: 104,
    minHeight: 44,
    paddingHorizontal: 10,
    // El seleccionado suma 1px de borde: se compensa para que no salte.
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: 14,
    fontFamily: FONT_SANS_BOLD,
    textAlign: 'center',
  },
});
