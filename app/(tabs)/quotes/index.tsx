import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput as NativeTextInput, View, useWindowDimensions } from 'react-native';
import { Button, Card, Icon, IconButton, Text } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useQuotes } from '@/features/quotes/hooks';
import { normalizeQuoteStatus, quoteStatusAccent, quoteStatusLabel } from '@/features/quotes/status';
import { formatCurrencyArs, formatDateAr, formatTimeShort } from '@/lib/format';
import { useAppTheme } from '@/theme';

const PAGE_SIZE_SINGLE_COLUMN = 5;
const PAGE_SIZE_GRID = 6;

export default function QuotesScreen() {
  const { data, isLoading, error } = useQuotes();
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const useCardGrid = width >= 360;
  const useTwoColumns = width >= 680;
  const pageSize = useCardGrid ? PAGE_SIZE_GRID : PAGE_SIZE_SINGLE_COLUMN;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

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

      return (
        item.title.toLowerCase().includes(query) ||
        item.client_name.toLowerCase().includes(query) ||
        searchableDate.includes(normalizedQuery)
      );
    });
  }, [quotes, search]);
  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / pageSize));
  const paginatedQuotes = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredQuotes.slice(startIndex, startIndex + pageSize);
  }, [filteredQuotes, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const rangeStart = filteredQuotes.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, filteredQuotes.length);
  const newJobSegmentBackground = theme.dark ? '#47627F' : '#ECF4FD';
  const newJobSegmentBorder = theme.dark ? '#FFFFFF' : '#D2E1F3';
  const newJobSegmentTextColor = theme.dark ? theme.colors.titleOnSoft : theme.colors.primary;

  return (
    <AppScreen title="Trabajos">
      <View
        style={[
          styles.searchComposer,
          {
            backgroundColor: theme.dark ? '#2B3138' : theme.colors.surface,
            borderColor: theme.colors.borderSoft,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nuevo trabajo"
          onPress={() => router.push('/quotes/new')}
          style={({ pressed }) => [
            styles.newJobSegment,
            {
              backgroundColor: newJobSegmentBackground,
              borderRightColor: newJobSegmentBorder,
            },
            pressed && styles.newJobSegmentPressed,
          ]}
        >
          <Text style={[styles.newJobSegmentText, { color: newJobSegmentTextColor }]}>Nuevo</Text>
        </Pressable>
        <View style={styles.searchInputSegment}>
          <Icon source="magnify" size={20} color={theme.colors.textMuted} />
          <NativeTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar trabajo..."
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, { color: theme.colors.onSurface }]}
            selectionColor={theme.colors.primary}
            accessibilityLabel="Buscar trabajos"
            returnKeyType="search"
          />
          {search.trim() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpiar busqueda"
              onPress={() => setSearch('')}
              style={({ pressed }) => [styles.clearSearchButton, pressed && styles.clearSearchButtonPressed]}
            >
              <Icon source="close-circle" size={18} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <LoadingOrError isLoading={isLoading} error={error} />

      {!isLoading && !error && filteredQuotes.length > 0 ? (
        <View style={styles.paginationHeader}>
          <Text style={[styles.paginationSummary, { color: theme.colors.textMuted }]}>
            Mostrando {rangeStart}-{rangeEnd} de {filteredQuotes.length}
          </Text>
          <Text style={[styles.paginationSummary, { color: theme.colors.textMuted }]}>
            Pagina {page} de {totalPages}
          </Text>
        </View>
      ) : null}

      <FlatList
        key={useCardGrid ? 'quotes-grid' : 'quotes-list'}
        data={paginatedQuotes}
        numColumns={useCardGrid ? 2 : 1}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={useCardGrid ? styles.columnsRow : undefined}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const dateValue = formatDateAr(item.appointment?.scheduled_for ?? item.created_at);
          const timeValue = formatTimeShort(item.appointment?.starts_at);
          const statusAccent = quoteStatusAccent(item.status);
          const descriptionValue = item.description?.trim() || item.notes?.trim() || 'Sin descripcion';

          return (
            <View style={[styles.quoteCardCell, useCardGrid && styles.quoteCardCellGrid]}>
              <AnimatedEntrance delay={90 + index * 40} distance={12}>
                <Link href={`/quotes/${item.id}`} asChild>
                  <Card mode="outlined" style={styles.quoteCard}>
                    <View style={[styles.headerBlock, { backgroundColor: theme.dark ? '#2A3545' : '#E8EDF4' }]}>
                      <View style={styles.headerRow}>
                        <Text style={[styles.headerTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <View style={styles.statusDotWrapper}>
                          <View
                            accessible
                            accessibilityLabel={quoteStatusLabel(item.status)}
                            style={[
                              styles.statusDot,
                              {
                                backgroundColor: statusAccent.backgroundColor,
                                borderColor: statusAccent.borderColor,
                              },
                            ]}
                          />
                        </View>
                      </View>
                    </View>
                    <Card.Content style={styles.quoteContent}>
                      <View style={[styles.metaColumns, !useTwoColumns && styles.metaColumnsStacked]}>
                        <View style={styles.metaColumn}>
                          <View style={[styles.metaCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceSoft }]}>
                            <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Cliente</Text>
                            <Text style={[styles.metaValue, { color: theme.colors.onSurface }]} numberOfLines={2}>
                              {item.client_name}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.metaCard,
                              styles.descriptionCard,
                              { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceSoft },
                            ]}
                          >
                            <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Descripcion</Text>
                            <Text style={[styles.metaValue, { color: theme.colors.onSurface }]} numberOfLines={useTwoColumns ? 4 : 3}>
                              {descriptionValue}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.metaColumn}>
                          <View style={[styles.metaCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceSoft }]}>
                            <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Fecha</Text>
                            <Text style={[styles.metaValue, { color: theme.colors.onSurface }]} numberOfLines={2}>
                              {timeValue ? `${dateValue} - ${timeValue}` : dateValue}
                            </Text>
                          </View>
                          <View style={[styles.metaCard, styles.totalCard, { backgroundColor: theme.colors.softBlue, borderColor: theme.colors.softBlueStrong }]}>
                            <Text style={[styles.metaLabel, styles.totalLabel, { color: theme.colors.primary }]}>Total</Text>
                            <Text style={[styles.totalValue, { color: theme.colors.primary }]}>{formatCurrencyArs(item.total)}</Text>
                          </View>
                        </View>
                      </View>
                      {normalizeQuoteStatus(item.status) === 'cancelled' ? (
                        <Text style={[styles.cancelledHint, { color: theme.colors.error }]}>Se elimina automaticamente a los 3 dias si sigue cancelado.</Text>
                      ) : null}
                    </Card.Content>
                  </Card>
                </Link>
              </AnimatedEntrance>
            </View>
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
  searchComposer: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  newJobSegment: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  newJobSegmentPressed: {
    opacity: 0.88,
  },
  newJobSegmentText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  searchInputSegment: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 15,
    lineHeight: 20,
  },
  clearSearchButton: {
    paddingVertical: 6,
  },
  clearSearchButtonPressed: {
    opacity: 0.72,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 12,
    gap: 10,
  },
  columnsRow: {
    gap: 10,
  },
  quoteCardCell: {
    marginBottom: 10,
  },
  quoteCardCellGrid: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  paginationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  paginationSummary: {
    fontSize: 12,
    lineHeight: 18,
  },
  quoteCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  headerBlock: {
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
  statusDotWrapper: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 26,
    height: 26,
    borderRadius: 26,
    borderWidth: 1,
  },
  quoteContent: {
    paddingTop: 10,
    gap: 8,
  },
  metaColumns: {
    flexDirection: 'row',
    gap: 8,
  },
  metaColumnsStacked: {
    flexDirection: 'column',
  },
  metaColumn: {
    flex: 1,
    gap: 8,
  },
  metaCard: {
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  metaLabel: {
    fontSize: 10,
    lineHeight: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
  },
  totalCard: {
  },
  totalLabel: {},
  descriptionCard: {},
  totalValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
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
