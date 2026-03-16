import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, IconButton, Text } from 'react-native-paper';

type CatalogAuditCardProps = {
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
};

const stripOperatorPrefix = (value: string): string => {
  const normalized = value.replace(/^Operador\s+/i, '').trim();
  return normalized || value;
};

export const CatalogAuditCard = ({ createdBy, createdAt, updatedBy, updatedAt }: CatalogAuditCardProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card mode="outlined" style={styles.card}>
      <View style={styles.headerRow}>
        <Text variant="titleSmall">Ediciones</Text>
        <IconButton
          icon={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          style={styles.toggleButton}
          accessibilityLabel={expanded ? 'Ocultar auditoria' : 'Mostrar auditoria'}
          onPress={() => setExpanded((current) => !current)}
        />
      </View>

      {expanded ? (
        <Card.Content style={styles.content}>
          <View style={styles.grid}>
            <View style={styles.cell}>
              <Text style={styles.label}>Creado por</Text>
              <Text style={styles.value}>{stripOperatorPrefix(createdBy)}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Creado el</Text>
              <Text style={styles.value}>{createdAt}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Ultima modificacion por</Text>
              <Text style={styles.value}>{stripOperatorPrefix(updatedBy)}</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.label}>Ultima modificacion</Text>
              <Text style={styles.value}>{updatedAt}</Text>
            </View>
          </View>
        </Card.Content>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
  },
  headerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 16,
    paddingRight: 8,
  },
  toggleButton: {
    margin: 0,
  },
  content: {
    gap: 12,
    paddingTop: 0,
    paddingBottom: 12,
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
