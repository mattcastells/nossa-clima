import { StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { formatDateAr, formatTimeShort } from '@/lib/format';

interface Props {
  scheduledFor: string;
  startsAt: string;
}

export function LinkedAppointmentCard({ scheduledFor, startsAt }: Props) {
  return (
    <Card mode="contained" style={styles.card}>
      <Card.Content style={styles.content}>
        <Text style={styles.title}>Turno seleccionado</Text>
        <Text style={styles.text}>
          {formatDateAr(scheduledFor)}
          {startsAt ? ` - ${formatTimeShort(startsAt)}` : ''}
        </Text>
        <Text style={styles.helper}>El turno se vincula al trabajo cuando guardas el formulario.</Text>
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  content: {
    gap: 4,
    paddingVertical: 10,
  },
  title: {
    fontWeight: '600',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  helper: {
    fontSize: 12,
    lineHeight: 18,
    color: '#5F6A76',
  },
});
