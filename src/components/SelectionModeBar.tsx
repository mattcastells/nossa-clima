import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { FONT_SANS_BOLD, useAppTheme } from '@/theme';

interface Props {
  count: number;
  /** Etiqueta en singular, p. ej. "material". Se pluraliza con "es". */
  itemLabel: string;
  onCancel: () => void;
  onArchive: () => void;
  loading?: boolean;
}

/**
 * Barra que aparece cuando hay elementos seleccionados en una lista del
 * catálogo. Archiva, no borra: ver archiveItems / archiveServices.
 */
export function SelectionModeBar({ count, itemLabel, onCancel, onArchive, loading = false }: Props) {
  const theme = useAppTheme();
  const label = count === 1 ? itemLabel : `${itemLabel}es`;

  return (
    <View style={[styles.bar, { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accentStrong }]}>
      <Icon source="checkbox-multiple-marked-outline" size={20} color={theme.colors.accentStrong} />
      <Text style={[styles.count, { color: theme.colors.accentStrong }]}>
        {count} {label}
      </Text>
      <Button mode="text" compact onPress={onCancel} disabled={loading} textColor={theme.colors.textMuted}>
        Cancelar
      </Button>
      <Button
        mode="contained"
        compact
        icon="archive-arrow-down-outline"
        onPress={onArchive}
        loading={loading}
        disabled={loading || count === 0}
        buttonColor={theme.colors.error}
        textColor="#FFFFFF"
        style={styles.archiveButton}
      >
        Archivar
      </Button>
    </View>
  );
}

/** Marca de selección para una fila de lista en modo selección. */
export function SelectionCheck({ selected }: { selected: boolean }) {
  const theme = useAppTheme();

  return (
    <Icon
      source={selected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
      size={22}
      color={selected ? theme.colors.accentStrong : theme.colors.outline}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  count: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONT_SANS_BOLD,
  },
  archiveButton: {
    borderRadius: 10,
  },
});
