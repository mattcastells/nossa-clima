import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Card, IconButton, Searchbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useQuotes } from '@/features/quotes/hooks';
import { normalizeQuoteStatus, quoteStatusAccent, quoteStatusLabel } from '@/features/quotes/status';
import { formatCurrencyArs, formatDateAr, formatTimeShort } from '@/lib/format';
import { BRAND_BLUE, BRAND_BLUE_SOFT } from '@/theme';

const PAGE_SIZE = 5;

export default function QuotesScreen() {
  const { data, isLoading, error } = useQuotes();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const useTwoColumns = width >= 680;

  const quotes = useMemo(() => data ?? [], [data]);
  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return quotes;

    const normalizedQuery = query.replace(/-/g, '/');

    return quotes.filter((item) => {
      const dateSource = item.appointment?.scheduled_for ?? item.created_at;
      const formattedDate = formatDateAr(dateSource);
      const formattedTime = formatTimeShort(item.appointment?.starts_at);
      const dateLabel = formattedTime ? `${formattedDate} ${formattedTime}` : formattedDate;
      const searchableDate = `${dateLabel} ${dateSource}`.toLowerCase().replace(/-/g, '/');

      return item.title.toLowerCase().includes(query) || searchableDate.includes(normalizedQuery);
    });
  }, [quotes, search]);
  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / PAGE_SIZE));
  const paginatedQuotes = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredQuotes.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredQuotes, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const rangeStart = filteredQuotes.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredQuotes.length);

  return (
    <AppScreen title="Trabajos">
      <View style={styles.topActions}>
        <Link href="/quotes/new" asChild>
          <Button mode="contained">Nuevo trabajo</Button>
        </Link>
      </View>

      <Searchbar
        placeholder="Buscar por titulo o fecha"
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
      />

      <LoadingOrError isLoading={isLoading} error={error} />

      {!isLoading && !error && filteredQuotes.length > 0 ? (
        <View style={styles.paginationHeader}>
          <Text style={styles.paginationSummary}>
            Mostrando {rangeStart}-{rangeEnd} de {filteredQuotes.length}
          </Text>
          <Text style={styles.paginationSummary}>
            Pagina {page} de {totalPages}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={paginatedQuotes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const dateValue = formatDateAr(item.appointment?.scheduled_for ?? item.created_at);
          const timeValue = formatTimeShort(item.appointment?.starts_at);
          const statusAccent = quoteStatusAccent(item.status);
          const descriptionValue = item.description?.trim() || item.notes?.trim() || 'Sin descripcion';

          return (
            <Link href={`/quotes/${item.id}`} asChild>
              <Card mode="outlined" style={styles.quoteCard}>
                <View style={styles.headerBlock}>
                  <View style={styles.headerRow}>
                    <Text style={styles.headerTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusAccent.backgroundColor,
                          borderColor: statusAccent.borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: statusAccent.textColor }]}>
                        {quoteStatusLabel(item.status)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Card.Content style={styles.quoteContent}>
                  <View style={[styles.metaColumns, !useTwoColumns && styles.metaColumnsStacked]}>
                    <View style={styles.metaColumn}>
                      <View style={styles.metaCard}>
                        <Text style={styles.metaLabel}>Cliente</Text>
                        <Text style={styles.metaValue} numberOfLines={2}>
                          {item.client_name}
                        </Text>
                      </View>
                      <View style={[styles.metaCard, styles.descriptionCard]}>
                        <Text style={styles.metaLabel}>Descripcion</Text>
                        <Text style={styles.metaValue} numberOfLines={useTwoColumns ? 4 : 3}>
                          {descriptionValue}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.metaColumn}>
                      <View style={styles.metaCard}>
                        <Text style={styles.metaLabel}>Fecha</Text>
                        <Text style={styles.metaValue} numberOfLines={2}>
                          {timeValue ? `${dateValue} - ${timeValue}` : dateValue}
                        </Text>
                      </View>
                      <View style={[styles.metaCard, styles.totalCard]}>
                        <Text style={[styles.metaLabel, styles.totalLabel]}>Total</Text>
                        <Text style={styles.totalValue}>{formatCurrencyArs(item.total)}</Text>
                      </View>
                    </View>
                  </View>
                  {normalizeQuoteStatus(item.status) === 'cancelled' ? (
                    <Text style={styles.cancelledHint}>Se elimina automaticamente a los 3 dias si sigue cancelado.</Text>
                  ) : null}
                </Card.Content>
              </Card>
            </Link>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text>{search.trim() ? 'No hay trabajos que coincidan con la busqueda.' : 'No hay trabajos cargados. Crea uno nuevo para comenzar.'}</Text>
          </View>
        }
      />

      {!isLoading && !error && totalPages > 1 ? (
        <View style={styles.paginationBar}>
          <IconButton
            icon="arrow-left"
            mode="outlined"
            size={18}
            accessibilityLabel="Pagina anterior"
            onPress={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            style={styles.paginationIcon}
          />
          <Button mode="contained-tonal" disabled>
            {page}/{totalPages}
          </Button>
          <IconButton
            icon="arrow-right"
            mode="outlined"
            size={18}
            accessibilityLabel="Pagina siguiente"
            onPress={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page === totalPages}
            style={styles.paginationIcon}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  searchbar: {
    borderRadius: 14,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  paginationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  paginationSummary: {
    color: '#5f6368',
    fontSize: 12,
    lineHeight: 18,
  },
  quoteCard: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerBlock: {
    backgroundColor: '#F6F8FB',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  quoteContent: {
    paddingTop: 14,
    gap: 10,
  },
  metaColumns: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  metaColumnsStacked: {
    flexDirection: 'column',
  },
  metaColumn: {
    flex: 1,
    gap: 10,
  },
  metaCard: {
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3E8EF',
    backgroundColor: '#F9FBFC',
  },
  descriptionCard: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: '#5f6368',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1F2937',
    fontWeight: '500',
  },
  totalCard: {
    backgroundColor: BRAND_BLUE_SOFT,
    borderColor: '#C5D4E6',
  },
  totalLabel: {
    color: BRAND_BLUE,
  },
  totalValue: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: BRAND_BLUE,
  },
  cancelledHint: {
    marginTop: 2,
    paddingHorizontal: 2,
    color: '#9F2F2F',
    fontSize: 12,
    lineHeight: 17,
  },
  emptyState: {
    paddingVertical: 8,
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  paginationIcon: {
    margin: 0,
  },
});
