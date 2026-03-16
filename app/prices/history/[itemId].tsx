import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItemPriceHistory } from '@/features/prices/hooks';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';
import { BRAND_GREEN, BRAND_GREEN_SOFT } from '@/theme';

export default function ItemHistoryPage() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { data, isLoading, error } = useItemPriceHistory(itemId);
  const itemName = data?.[0]?.item_name ?? 'Material';

  return (
    <AppScreen title="Historial de precios" showHomeButton={false}>
      <LoadingOrError isLoading={isLoading} error={error} />

      {!isLoading && !error ? (
        <>
          <Card mode="outlined" style={styles.summaryCard}>
            <Card.Content style={styles.summaryContent}>
              <Text variant="labelMedium">Material</Text>
              <Text variant="titleMedium">{itemName}</Text>
              <Text style={styles.summaryHelper}>
                {data?.length ? `${data.length} registro${data.length === 1 ? '' : 's'}` : 'Sin registros cargados'}
              </Text>
            </Card.Content>
          </Card>

          <Card mode="outlined" style={styles.tableCard}>
            <Card.Content style={styles.tableContent}>
              <View style={styles.tableHeaderBlock}>
                <Text variant="titleSmall">Registros</Text>
                <Text style={styles.helperText}>Ordenados del mas reciente al mas antiguo.</Text>
              </View>

              {data?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
                  <View style={styles.tableFrame}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.headerCell, styles.storeColumn]}>Local</Text>
                    <Text style={[styles.headerCell, styles.priceColumn]}>Precio</Text>
                    <Text style={[styles.headerCell, styles.dateColumn]}>Fecha</Text>
                  </View>

                  {data.map((item, index) => (
                    <View key={item.id} style={[styles.tableRow, index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd]}>
                      <Text style={[styles.rowCell, styles.storeColumn, styles.storeValue]}>{item.store_name}</Text>
                      <Text style={[styles.rowCell, styles.priceColumn, styles.priceValue]}>{formatCurrencyArs(item.price)}</Text>
                      <Text style={[styles.rowCell, styles.dateColumn]}>{formatDateAr(item.observed_at)}</Text>
                    </View>
                  ))}
                  </View>
                </ScrollView>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.helperText}>Sin historial para este material.</Text>
                </View>
              )}
            </Card.Content>
          </Card>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: 12,
  },
  summaryContent: {
    gap: 4,
    paddingVertical: 8,
  },
  summaryHelper: {
    color: '#5f6368',
    fontSize: 12,
    lineHeight: 18,
  },
  tableCard: {
    borderRadius: 12,
  },
  tableContent: {
    gap: 10,
    paddingVertical: 8,
  },
  tableHeaderBlock: {
    gap: 2,
  },
  helperText: {
    color: '#5f6368',
    fontSize: 12,
    lineHeight: 18,
  },
  tableScrollContent: {
    paddingBottom: 2,
  },
  tableFrame: {
    minWidth: 455,
    gap: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_GREEN_SOFT,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerCell: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: BRAND_GREEN,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DCE4EC',
  },
  tableRowEven: {
    backgroundColor: '#FFFFFF',
  },
  tableRowOdd: {
    backgroundColor: '#F8FBFF',
  },
  rowCell: {
    fontSize: 13,
    lineHeight: 18,
  },
  storeColumn: {
    width: 180,
    paddingRight: 8,
  },
  priceColumn: {
    width: 130,
    paddingRight: 8,
  },
  dateColumn: {
    width: 110,
  },
  storeValue: {
    fontWeight: '500',
  },
  priceValue: {
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 8,
  },
});
