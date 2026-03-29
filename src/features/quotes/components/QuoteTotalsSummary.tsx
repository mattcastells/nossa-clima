import { StyleSheet, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';

import { formatCurrencyArs } from '@/lib/format';
import { useAppTheme } from '@/theme';

interface Props {
  subtotalMaterials: number;
  subtotalServices: number;
  total: number;
}

export const QuoteTotalsSummary = ({ subtotalMaterials, subtotalServices, total }: Props) => {
  const theme = useAppTheme();

  return (
    <Surface style={[styles.container, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]} elevation={2}>
      <View style={styles.grid}>
        <View style={[styles.cell, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
          <Text variant="labelMedium" style={[styles.label, { color: theme.colors.textMuted }]}>
            Subtotal materiales
          </Text>
          <Text variant="titleLarge" style={[styles.value, { color: theme.colors.onSurface }]}>
            {formatCurrencyArs(subtotalMaterials)}
          </Text>
        </View>
        <View style={[styles.cell, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
          <Text variant="labelMedium" style={[styles.label, { color: theme.colors.textMuted }]}>
            Subtotal mano de obra
          </Text>
          <Text variant="titleLarge" style={[styles.value, { color: theme.colors.onSurface }]}>
            {formatCurrencyArs(subtotalServices)}
          </Text>
        </View>
        <View style={[styles.cell, styles.totalCell, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.softBlue }]}>
          <Text variant="labelMedium" style={[styles.label, { color: theme.colors.primary }]}>
            Total final
          </Text>
          <Text variant="headlineSmall" style={{ color: theme.colors.primary, fontWeight: '700' }}>
            {formatCurrencyArs(total)}
          </Text>
        </View>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 0,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'column',
  },
  cell: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  totalCell: {
    borderBottomWidth: 0,
  },
  label: {
    marginBottom: 6,
  },
  value: {
    fontWeight: '600',
  },
});
