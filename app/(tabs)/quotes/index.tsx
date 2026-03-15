import { Link } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useQuotes } from '@/features/quotes/hooks';
import { formatCurrencyArs, formatDateAr, formatTimeShort } from '@/lib/format';

export default function QuotesScreen() {
  const { data, isLoading, error } = useQuotes();

  return (
    <AppScreen title="Trabajos">
      <View style={styles.topActions}>
        <Link href="/quotes/new" asChild>
          <Button mode="contained">Nuevo trabajo</Button>
        </Link>
        <Link href="/quotes/cleanup" asChild>
          <Button mode="outlined" icon="delete-sweep-outline">
            Limpiar antiguos
          </Button>
        </Link>
      </View>

      <LoadingOrError isLoading={isLoading} error={error} />

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const dateValue = formatDateAr(item.appointment?.scheduled_for ?? item.created_at);
          const timeValue = formatTimeShort(item.appointment?.starts_at);

          return (
            <Link href={`/quotes/${item.id}`} asChild>
              <Card mode="outlined" style={styles.quoteCard}>
                <View style={styles.headerBlock}>
                  <Text style={styles.headerTitle}>{item.title}</Text>
                </View>
                <Card.Content style={styles.quoteContent}>
                  <View style={styles.metaBlock}>
                    <Text style={styles.metaLabel}>Cliente:</Text>
                    <Text style={styles.metaValue}>{item.client_name}</Text>
                  </View>
                  <View style={styles.metaBlock}>
                    <Text style={styles.metaLabel}>Fecha:</Text>
                    <Text style={styles.metaValue}>{timeValue ? `${dateValue} - ${timeValue}` : dateValue}</Text>
                  </View>
                  <View style={styles.metaBlock}>
                    <Text style={styles.metaLabel}>Descripcion:</Text>
                    <Text style={styles.metaValue}>{item.description?.trim() || item.notes?.trim() || 'Sin descripcion'}</Text>
                  </View>
                  <View style={styles.metaBlock}>
                    <Text style={styles.metaLabel}>Total:</Text>
                    <Text style={styles.totalValue}>{formatCurrencyArs(item.total)}</Text>
                  </View>
                </Card.Content>
              </Card>
            </Link>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text>No hay trabajos cargados. Crea uno nuevo para comenzar.</Text>
          </View>
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  quoteCard: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerBlock: {
    backgroundColor: '#F6F8FB',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  quoteContent: {
    paddingTop: 12,
    gap: 8,
  },
  metaBlock: {
    gap: 2,
  },
  metaLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#5f6368',
  },
  metaValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  totalValue: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 8,
  },
});
