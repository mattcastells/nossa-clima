import { type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { FONT_SANS_BOLD, useAppTheme } from '@/theme';

/**
 * Panel de selección con altura acotada y scroll propio.
 *
 * Está pensado para las listas que viven dentro de un formulario (elegir
 * servicio, tienda o material). La regla es que la lista se muestra COMPLETA:
 * antes se cortaba con `.slice(0, 8)` y el usuario no podía elegir lo que no
 * veía. La altura la limita el panel, no el filtro.
 *
 * El `nestedScrollEnabled` es obligatorio: la pantalla ya está dentro del
 * ScrollView de AppScreen.
 */

export type SelectionTone = 'blue' | 'green';

interface PanelProps<T> {
  data: T[];
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  emptyText: string;
  /** Alto máximo del panel. 300 es el estándar de la app. */
  maxHeight?: number;
}

export function SelectionPanel<T>({ data, keyExtractor, renderItem, emptyText, maxHeight = 300 }: PanelProps<T>) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.panel,
        {
          maxHeight,
          backgroundColor: theme.colors.surfaceMuted,
          borderColor: theme.colors.borderSoft,
        },
      ]}
    >
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.panelContent}
        renderItem={({ item }) => <>{renderItem(item)}</>}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>{emptyText}</Text>
        }
      />
    </View>
  );
}

interface RowProps {
  title: string;
  meta?: string | null;
  trailing?: string | null;
  selected: boolean;
  tone?: SelectionTone;
  disabled?: boolean;
  onPress: () => void;
}

/**
 * Fila seleccionable. Lo seleccionado se marca con borde de acento + check,
 * no solo con el fondo: un fondo claro fijo sobre interfaz oscura "brilla en
 * blanco" y se pierde el texto. El fondo suave sale de los tokens del tema,
 * así que cambia con el modo oscuro.
 */
export function SelectionRow({ title, meta, trailing, selected, tone = 'blue', disabled = false, onPress }: RowProps) {
  const theme = useAppTheme();
  const selectedBackground = tone === 'green' ? theme.colors.softGreen : theme.colors.softBlue;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
        selected && {
          backgroundColor: selectedBackground,
          borderColor: theme.colors.accentStrong,
          borderWidth: 2,
        },
        pressed && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      {selected ? (
        <Icon source="check-circle" size={18} color={theme.colors.accentStrong} />
      ) : null}
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={2}>
          {title}
        </Text>
        {meta ? (
          <Text style={[styles.rowMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text style={[styles.rowTrailing, { color: theme.colors.titleOnSoft }]}>{trailing}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    overflow: 'hidden',
  },
  panelContent: {
    paddingTop: 2,
    paddingBottom: 6,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingVertical: 22,
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    // El borde de seleccionado es de 2px: se compensa el padding para que la
    // fila no salte de tamaño al elegirla.
    paddingHorizontal: 11,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowPressed: {
    opacity: 0.78,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT_SANS_BOLD,
  },
  rowMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowTrailing: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT_SANS_BOLD,
    fontVariant: ['tabular-nums'],
  },
});
