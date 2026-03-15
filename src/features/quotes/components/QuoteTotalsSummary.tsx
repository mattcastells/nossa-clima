import { StyleSheet, View } from 'react-native';
import { Surface, Text } from 'react-native-paper';

import { formatCurrencyArs } from '@/lib/format';

interface Props {
  subtotalMaterials: number;
  subtotalServices: number;
  total: number;
}

export const QuoteTotalsSummary = ({ subtotalMaterials, subtotalServices, total }: Props) => (
  <Surface style={styles.container} elevation={2}>
    <View style={styles.grid}>
      <View style={styles.cell}>
        <Text variant="labelMedium" style={styles.label}>
          Subtotal materiales
        </Text>
        <Text variant="titleLarge" style={styles.value}>
          {formatCurrencyArs(subtotalMaterials)}
        </Text>
      </View>
      <View style={styles.cell}>
        <Text variant="labelMedium" style={styles.label}>
          Subtotal mano de obra
        </Text>
        <Text variant="titleLarge" style={styles.value}>
          {formatCurrencyArs(subtotalServices)}
        </Text>
      </View>
      <View style={[styles.cell, styles.totalCell]}>
        <Text variant="labelMedium" style={styles.label}>
          Total final
        </Text>
        <Text variant="headlineSmall">{formatCurrencyArs(total)}</Text>
      </View>
    </View>
  </Surface>
);

const styles = StyleSheet.create({
  container: {
    padding: 0,
    borderRadius: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    flexGrow: 1,
    flexBasis: 220,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#DCE4EC',
  },
  totalCell: {
    backgroundColor: '#F5F7FB',
    borderRightWidth: 0,
  },
  label: {
    color: '#5f6368',
    marginBottom: 6,
  },
  value: {
    fontWeight: '600',
  },
});
