import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput as NativeTextInput, View, useWindowDimensions } from 'react-native';
import { Button, Card, Icon, IconButton, Text } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useQuotes } from '@/features/quotes/hooks';
import { normalizeQuoteStatus, quoteStatusAccent, quoteStatusLabel } from '@/features/quotes/status';
import { formatCurrencyArs, formatDateAr, formatTimeShort } from '@/lib/format';
import { useAppTheme } from '@/theme';
import type { JobQuoteStatus } from '@/types/db';

const PAGE_SIZE_SINGLE_COLUMN = 8;
const PAGE_SIZE_GRID = 10;

type StatusFilter = 'all' | JobQuoteStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'completed', label: 'Terminados' },
  { value: 'cancelled', label: 'Cancelados' },
];

export default function QuotesScreen() {
  const { data, isLoading, error } = useQuotes();
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const useTwoColumns = width >= 680;
  const pageSize = useTwoColumns ? PAGE_SIZE_GRID : PAGE_SIZE_SINGLE_COLUMN;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const quotes = useMemo(() => data ?? [], [data]);
  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const normalizedQuery = query.replace(/-/g, '/');

    return quotes.filter((item) => {
      if (statusFilter !== 'all' && normalizeQuoteStatus(item.status) !== statusFilter) {
        return false;
      }
      if (!query) return true;

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
  }, [quotes, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQuotes.length / pageSize));
  const paginatedQuotes = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredQuotes.slice(startIndex, startIndex + pageSize);
  }, [filteredQuotes, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  return (
    <AppScreen
      title="Trabajos"
      titleRight={
        <IconButton
          icon="plus"
          mode="contained"
          size={22}
          accessibilityLabel="Nuevo trabajo"
          containerColor={theme.colors.accent}
          iconColor={theme.colors.onAccent}
          style={styles.newButton}
          onPress={() => router.push('/quotes/new')}
        />
      }
      headerContent={
      <>
      <View style={[styles.searchBar, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Icon source="magnify" size={20} color={theme.colors.textMuted} />
        <NativeTextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar cliente o trabajo"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
          selectionColor={theme.colors.accent}
          accessibilityLabel="Buscar trabajos"
          returnKeyType="search"
        />
        {search.trim() ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Limpiar busqueda" onPress={() => setSearch('')} hitSlop={8}>
            <Icon source="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        keyboardShouldPersistTaps="handled"
      >
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.value;
          const accent = filter.value === 'all' ? null : quoteStatusAccent(filter.value);
          const activeBg = accent ? accent.backgroundColor : theme.colors.primary;
          const activeBorder = accent ? accent.borderColor : theme.colors.primary;
          const activeText = accent ? accent.textColor : '#FFFFFF';
          return (
            <Pressable
              key={filter.value}
              accessibilityRole="button"
              onPress={() => setStatusFilter(filter.value)}
              style={[
                styles.filterChip,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
                active && { backgroundColor: activeBg, borderColor: activeBorder },
              ]}
            >
              <Text style={[styles.filterChipText, { color: active ? activeText : theme.colors.textMuted }]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </>
      }
    >
      <LoadingOrError isLoading={isLoading} error={error} />

      <FlatList
        key={useTwoColumns ? 'quotes-grid' : 'quotes-list'}
        data={paginatedQuotes}
        numColumns={useTwoColumns ? 2 : 1}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={useTwoColumns ? styles.columnsRow : undefined}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const dateValue = formatDateAr(item.appointment?.scheduled_for ?? item.created_at);
          const timeValue = formatTimeShort(item.appointment?.starts_at);
          const statusAccent = quoteStatusAccent(item.status);
          const isCancelled = normalizeQuoteStatus(item.status) === 'cancelled';

          return (
            <View style={[styles.quoteCardCell, useTwoColumns && styles.quoteCardCellGrid]}>
              <AnimatedEntrance delay={60 + index * 35} distance={12}>
                <Link href={`/quotes/${item.id}`} asChild>
                  <Card mode="outlined" style={[styles.quoteCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}>
                    <Card.Content style={styles.quoteContent}>
                      <View style={styles.headerRow}>
                        <Text style={[styles.headerTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={2}>
                          {item.title}
                        </Text>
                        <View
                          accessible
                          accessibilityLabel={quoteStatusLabel(item.status)}
                          style={[styles.statusBadge, { backgroundColor: statusAccent.backgroundColor, borderColor: statusAccent.borderColor }]}
                        >
                          <View style={[styles.statusDot, { backgroundColor: statusAccent.textColor }]} />
                          <Text style={[styles.statusBadgeText, { color: statusAccent.textColor }]} numberOfLines={1}>
                            {quoteStatusLabel(item.status)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.metaRow}>
                        <Icon source="account-outline" size={16} color={theme.colors.textMuted} />
                        <Text style={[styles.metaText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                          {item.client_name}
                        </Text>
                      </View>
                      <View style={styles.metaRow}>
                        <Icon source="calendar-outline" size={16} color={theme.colors.textMuted} />
                        <Text style={[styles.metaText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                          {timeValue ? `${dateValue} · ${timeValue}` : dateValue}
                        </Text>
                      </View>

                      <View style={[styles.totalRow, { borderTopColor: theme.colors.borderSoft }]}>
                        <Text style={[styles.totalLabel, { color: theme.colors.textMuted }]}>Total</Text>
                        <Text style={[styles.totalValue, { color: theme.colors.primary }]}>{formatCurrencyArs(item.total)}</Text>
                      </View>

                      {isCancelled ? (
                        <Text style={[styles.cancelledHint, { color: theme.colors.error }]}>Se elimina a los 3 días si sigue cancelado.</Text>
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
            <Icon source="briefcase-outline" size={40} color={theme.colors.borderSoft} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {search.trim() || statusFilter !== 'all' ? 'No hay trabajos que coincidan.' : 'Todavía no hay trabajos. Creá uno nuevo para empezar.'}
            </Text>
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
  newButton: { margin: 0, borderRadius: 13 },
  searchBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 15,
    lineHeight: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 18,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 12,
    gap: 12,
  },
  columnsRow: {
    gap: 12,
  },
  quoteCardCell: {
    marginBottom: 0,
  },
  quoteCardCellGrid: {
    flex: 1,
    minWidth: 0,
  },
  quoteCard: {
    flex: 1,
    borderRadius: 18,
  },
  quoteContent: {
    paddingVertical: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  metaText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    flex: 1,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  cancelledHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 260,
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
