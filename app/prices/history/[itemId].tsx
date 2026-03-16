import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItemMeasurePriceHistory, useItemPriceHistory } from '@/features/prices/hooks';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';
import { formatMeasuredItemDisplayName } from '@/lib/itemDisplay';
import { useAppTheme } from '@/theme';

export default function ItemHistoryPage() {
  const theme = useAppTheme();
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const baseHistoryQuery = useItemPriceHistory(itemId);
  const measureHistoryQuery = useItemMeasurePriceHistory(itemId);

  const baseHistory = baseHistoryQuery.data ?? [];
  const measureHistory = measureHistoryQuery.data ?? [];
  const loading = baseHistoryQuery.isLoading || measureHistoryQuery.isLoading;
  const error = baseHistoryQuery.error ?? measureHistoryQuery.error ?? null;

  const itemName =
    measureHistory[0]?.item_name ??
    baseHistory[0]?.item_name ??
    'Material';

  return (
    <AppScreen title="Historial de precios" showHomeButton={false}>
      <LoadingOrError isLoading={loading} error={error} />

      {!loading && !error ? (
        <>
          <Card mode="outlined" style={[styles.summaryCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
            <Card.Content style={styles.summaryContent}>
              <Text variant="labelMedium" style={{ color: theme.colors.textMuted }}>
                Material
              </Text>
              <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                {itemName}
              </Text>
              <Text style={[styles.summaryHelper, { color: theme.colors.textMuted }]}>
                {measureHistory.length > 0
                  ? `${measureHistory.length} registros por medida`
                  : baseHistory.length > 0
                    ? `${baseHistory.length} registros base`
                    : 'Sin registros cargados'}
              </Text>
            </Card.Content>
          </Card>

          {measureHistory.length > 0 ? (
            <Card mode="outlined" style={[styles.tableCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
              <Card.Content style={styles.tableContent}>
                <View style={styles.tableHeaderBlock}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                    Precios por medida
                  </Text>
                  <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                    Valores finales por metro, ordenados del mas reciente al mas antiguo.
                  </Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
                  <View style={styles.tableFrame}>
                    <View style={[styles.tableHeader, { backgroundColor: theme.colors.softGreen }]}>
                      <Text style={[styles.headerCell, styles.materialColumn, { color: theme.colors.titleOnSoft }]}>Medida</Text>
                      <Text style={[styles.headerCell, styles.storeColumn, { color: theme.colors.titleOnSoft }]}>Local</Text>
                      <Text style={[styles.headerCell, styles.priceColumn, { color: theme.colors.titleOnSoft }]}>Precio</Text>
                      <Text style={[styles.headerCell, styles.originColumn, { color: theme.colors.titleOnSoft }]}>Origen</Text>
                      <Text style={[styles.headerCell, styles.dateColumn, { color: theme.colors.titleOnSoft }]}>Fecha</Text>
                    </View>

                    {measureHistory.map((row, index) => (
                      <View
                        key={row.id}
                        style={[
                          styles.tableRow,
                          { borderColor: theme.colors.borderSoft },
                          index % 2 === 0 ? { backgroundColor: theme.colors.surface } : { backgroundColor: theme.colors.surfaceSoft },
                        ]}
                      >
                        <Text style={[styles.rowCell, styles.materialColumn, styles.strongCell, { color: theme.colors.onSurface }]}>
                          {formatMeasuredItemDisplayName(
                            { name: row.item_name },
                            { label: row.item_measurement_label, unit: row.measurement_unit },
                          )}
                        </Text>
                        <Text style={[styles.rowCell, styles.storeColumn, { color: theme.colors.onSurface }]}>{row.store_name}</Text>
                        <Text style={[styles.rowCell, styles.priceColumn, styles.strongCell, { color: theme.colors.onSurface }]}>
                          {formatCurrencyArs(row.price)} / {row.measurement_unit}
                        </Text>
                        <Text style={[styles.rowCell, styles.originColumn, { color: theme.colors.textMuted }]}>
                          {row.price_origin === 'calculated' ? 'Calculado' : 'Manual'}
                        </Text>
                        <Text style={[styles.rowCell, styles.dateColumn, { color: theme.colors.textMuted }]}>{formatDateAr(row.observed_at)}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </Card.Content>
            </Card>
          ) : null}

          {baseHistory.length > 0 ? (
            <Card mode="outlined" style={[styles.tableCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
              <Card.Content style={styles.tableContent}>
                <View style={styles.tableHeaderBlock}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                    Base por kg o precio directo
                  </Text>
                  <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                    Se usa como referencia para materiales sin medidas o para medidas calculadas.
                  </Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
                  <View style={styles.tableFrameBase}>
                    <View style={[styles.tableHeader, { backgroundColor: theme.colors.softBlue }]}>
                      <Text style={[styles.headerCell, styles.storeColumn, { color: theme.colors.titleOnSoft }]}>Local</Text>
                      <Text style={[styles.headerCell, styles.priceColumn, { color: theme.colors.titleOnSoft }]}>Precio</Text>
                      <Text style={[styles.headerCell, styles.referenceColumn, { color: theme.colors.titleOnSoft }]}>Referencia</Text>
                      <Text style={[styles.headerCell, styles.dateColumn, { color: theme.colors.titleOnSoft }]}>Fecha</Text>
                    </View>

                    {baseHistory.map((row, index) => (
                      <View
                        key={row.id}
                        style={[
                          styles.tableRow,
                          { borderColor: theme.colors.borderSoft },
                          index % 2 === 0 ? { backgroundColor: theme.colors.surface } : { backgroundColor: theme.colors.surfaceSoft },
                        ]}
                      >
                        <Text style={[styles.rowCell, styles.storeColumn, { color: theme.colors.onSurface }]}>{row.store_name}</Text>
                        <Text style={[styles.rowCell, styles.priceColumn, styles.strongCell, { color: theme.colors.onSurface }]}>
                          {formatCurrencyArs(row.price)}
                        </Text>
                        <Text style={[styles.rowCell, styles.referenceColumn, { color: theme.colors.textMuted }]}>
                          {row.quantity_reference ?? row.base_price_label ?? row.item_unit ?? 'Directo'}
                        </Text>
                        <Text style={[styles.rowCell, styles.dateColumn, { color: theme.colors.textMuted }]}>{formatDateAr(row.observed_at)}</Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </Card.Content>
            </Card>
          ) : null}

          {measureHistory.length === 0 && baseHistory.length === 0 ? (
            <Card mode="outlined" style={[styles.tableCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
              <Card.Content>
                <Text style={{ color: theme.colors.textMuted }}>Sin historial para este material.</Text>
              </Card.Content>
            </Card>
          ) : null}
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
    fontSize: 12,
    lineHeight: 18,
  },
  tableScrollContent: {
    paddingBottom: 2,
  },
  tableFrame: {
    minWidth: 720,
    gap: 8,
  },
  tableFrameBase: {
    minWidth: 560,
    gap: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  headerCell: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderWidth: 1,
  },
  rowCell: {
    fontSize: 13,
    lineHeight: 18,
  },
  strongCell: {
    fontWeight: '600',
  },
  materialColumn: {
    width: 220,
    paddingRight: 8,
  },
  storeColumn: {
    width: 160,
    paddingRight: 8,
  },
  priceColumn: {
    width: 130,
    paddingRight: 8,
  },
  originColumn: {
    width: 110,
    paddingRight: 8,
  },
  referenceColumn: {
    width: 160,
    paddingRight: 8,
  },
  dateColumn: {
    width: 100,
  },
});
