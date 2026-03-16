import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

type CatalogAuditCardProps = {
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
};

export const CatalogAuditCard = ({ createdBy, createdAt, updatedBy, updatedAt }: CatalogAuditCardProps) => (
  <Card mode="outlined" style={styles.card}>
    <Card.Content style={styles.content}>
      <Text variant="titleSmall">Auditoria</Text>
      <View style={styles.grid}>
        <View style={styles.cell}>
          <Text style={styles.label}>Creado por</Text>
          <Text style={styles.value}>{createdBy}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Creado el</Text>
          <Text style={styles.value}>{createdAt}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Ultima modificacion por</Text>
          <Text style={styles.value}>{updatedBy}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.label}>Ultima modificacion</Text>
          <Text style={styles.value}>{updatedAt}</Text>
        </View>
      </View>
    </Card.Content>
  </Card>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
  },
  content: {
    gap: 12,
    paddingVertical: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  cell: {
    minWidth: 140,
    flexGrow: 1,
    gap: 4,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    color: '#5f6368',
  },
  value: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
});
