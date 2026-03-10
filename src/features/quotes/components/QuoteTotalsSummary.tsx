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
    <View>
      <Text variant="titleSmall">Subtotal materiales</Text>
      <Text variant="titleMedium">{formatCurrencyArs(subtotalMaterials)}</Text>
    </View>
    <View>
      <Text variant="titleSmall">Subtotal mano de obra</Text>
      <Text variant="titleMedium">{formatCurrencyArs(subtotalServices)}</Text>
    </View>
    <View>
      <Text variant="titleSmall">Total final</Text>
      <Text variant="headlineSmall">{formatCurrencyArs(total)}</Text>
    </View>
  </Surface>
);

const styles = StyleSheet.create({
  container: {
    padding: 12,
    gap: 8,
    borderRadius: 12,
  },
});
