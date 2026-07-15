import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput as NativeTextInput, useWindowDimensions, View } from 'react-native';
import { Button, Icon, IconButton, Menu, Text, TouchableRipple } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useServiceCategories, useServices } from '@/features/services/hooks';
import { formatCurrencyArs } from '@/lib/format';
import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, FONT_SANS_MEDIUM, useAppTheme } from '@/theme';

const ALL_CATEGORIES = '__all__';
const UNCATEGORIZED_CATEGORY = '__uncategorized__';
const PAGE_SIZE = 10;

type ServiceCategoryOption = { key: string; label: string };

export default function ServicesScreen() {
  const { data, isLoading, error } = useServices();
  const theme = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const menuWidth = screenWidth - 32;
  const { data: categoryNames, isLoading: categoriesLoading, error: categoriesError } = useServiceCategories();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const uncategorizedCount = useMemo(
    () => (data ?? []).filter((service) => (service.category?.trim() ?? '').length === 0).length,
    [data],
  );

  const categories = useMemo<ServiceCategoryOption[]>(() => {
    const base = (categoryNames ?? []).map((category) => ({ key: category, label: category }));
    if (uncategorizedCount > 0) base.push({ key: UNCATEGORIZED_CATEGORY, label: 'Sin categoría' });
    return base;
  }, [categoryNames, uncategorizedCount]);

  useEffect(() => {
    if (selectedCategory === ALL_CATEGORIES) return;
    if (selectedCategory === UNCATEGORIZED_CATEGORY) {
      if (uncategorizedCount === 0) setSelectedCategory(ALL_CATEGORIES);
      return;
    }
    if (!categories.some((category) => category.key === selectedCategory)) setSelectedCategory(ALL_CATEGORIES);
  }, [categories, selectedCategory, uncategorizedCount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES) return 'Todas';
    return categories.find((c) => c.key === selectedCategory)?.label ?? 'Todas';
  }, [categories, selectedCategory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((service) => {
      const normalizedCategory = service.category?.trim() ?? '';
      if (selectedCategory === UNCATEGORIZED_CATEGORY) {
        if (normalizedCategory.length > 0) return false;
      } else if (selectedCategory !== ALL_CATEGORIES && normalizedCategory !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        service.name.toLowerCase().includes(q) ||
        (service.description ?? '').toLowerCase().includes(q) ||
        (service.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filtered, currentPage]);

  return (
    <AppScreen
      title="Servicios"
      titleRight={
        <View style={styles.titleActions}>
          <Link href="/services/categories" asChild>
            <Button
              mode="text"
              compact
              textColor={theme.colors.accentStrong}
              labelStyle={styles.categoriesLabel}
            >
              Categorías
            </Button>
          </Link>
          <IconButton
            icon="plus"
            mode="contained"
            size={22}
            accessibilityLabel="Nuevo servicio"
            containerColor={theme.colors.accent}
            iconColor={theme.colors.onAccent}
            style={styles.newButton}
            onPress={() => router.push('/services/new')}
          />
        </View>
      }
      headerContent={
      <View style={styles.toolsRow}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Icon source="magnify" size={20} color={theme.colors.textMuted} />
          <NativeTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar servicio"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, { color: theme.colors.onSurface }]}
            selectionColor={theme.colors.accent}
            returnKeyType="search"
          />
          {search.trim() ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Limpiar" onPress={() => setSearch('')} hitSlop={8}>
              <Icon source="close-circle" size={18} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Menu
          visible={categoryMenuOpen}
          onDismiss={() => setCategoryMenuOpen(false)}
          anchorPosition="bottom"
          contentStyle={[styles.menuContent, { width: menuWidth, backgroundColor: theme.colors.surface }]}
          anchor={
            <TouchableRipple
              onPress={() => setCategoryMenuOpen(true)}
              style={[styles.filterChip, { backgroundColor: theme.colors.softYellow, borderColor: theme.colors.softYellowStrong }]}
              borderless
            >
              <View style={styles.filterChipInner}>
                <Text style={[styles.filterChipText, { color: theme.colors.onSoftYellow }]} numberOfLines={1}>
                  {selectedCategoryLabel}
                </Text>
                <Icon source="chevron-down" size={16} color={theme.colors.onSoftYellow} />
              </View>
            </TouchableRipple>
          }
        >
          <View style={styles.menuGrid}>
            {[{ key: ALL_CATEGORIES, label: 'Todas' }, ...categories].map((item) => {
              const isSelected = selectedCategory === item.key;
              return (
                <TouchableRipple
                  key={item.key}
                  onPress={() => { setSelectedCategory(item.key); setCategoryMenuOpen(false); }}
                  style={[
                    styles.menuItem,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
                    isSelected && { backgroundColor: theme.colors.softYellow, borderColor: theme.colors.softYellowStrong },
                  ]}
                  borderless
                >
                  <View style={styles.menuItemInner}>
                    {isSelected ? <Icon source="check" size={14} color={theme.colors.onSoftYellow} /> : null}
                    <Text style={[styles.menuItemText, { color: theme.colors.onSurface }, isSelected && styles.menuItemTextSelected]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                </TouchableRipple>
              );
            })}
          </View>
        </Menu>
      </View>
      }
    >
      <LoadingOrError isLoading={isLoading || categoriesLoading} error={error ?? categoriesError} />

      <FlatList
        data={paginated}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
        renderItem={({ item, index }) => (
          <AnimatedEntrance delay={60 + index * 35} distance={12}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/services/${item.id}`)}
                style={({ pressed }) => [
                  styles.serviceCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.serviceMain}>
                  <Text style={[styles.serviceTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View style={[styles.categoryChip, { backgroundColor: theme.colors.softYellow }]}>
                    <Text style={[styles.categoryChipText, { color: theme.colors.onSoftYellow }]} numberOfLines={1}>
                      {item.category ?? 'Sin categoría'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.servicePrice, { color: theme.colors.primary }]}>{formatCurrencyArs(item.base_price)}</Text>
              </Pressable>
          </AnimatedEntrance>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon source="wrench-outline" size={40} color={theme.colors.borderSoft} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No hay servicios que coincidan.</Text>
          </View>
        }
      />

      {filtered.length > PAGE_SIZE && (
        <View style={styles.paginationRow}>
          <Button mode="outlined" compact icon="chevron-left" disabled={currentPage === 1} onPress={() => setCurrentPage((p) => p - 1)} style={styles.pageButton}>
            Anterior
          </Button>
          <Text style={[styles.pageInfo, { color: theme.colors.textMuted }]}>
            {`${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} de ${filtered.length}`}
          </Text>
          <Button mode="outlined" compact contentStyle={styles.pageNextContent} icon="chevron-right" disabled={currentPage >= totalPages} onPress={() => setCurrentPage((p) => p + 1)} style={styles.pageButton}>
            Siguiente
          </Button>
        </View>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  categoriesLabel: { fontSize: 13, fontFamily: FONT_SANS_BOLD },
  newButton: { margin: 0, borderRadius: 13 },
  toolsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  searchBar: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontSize: 15, lineHeight: 20 },
  filterChip: { minHeight: 44, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  filterChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filterChipText: { fontSize: 14, fontFamily: FONT_SANS_BOLD, maxWidth: 120 },
  menuContent: { paddingVertical: 6, borderRadius: 14 },
  menuGrid: { paddingHorizontal: 8, paddingVertical: 4, gap: 6 },
  menuItem: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  menuItemInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuItemText: { fontSize: 14, fontFamily: FONT_SANS_MEDIUM },
  menuItemTextSelected: { fontFamily: FONT_SANS_EXTRABOLD },
  listContent: { paddingTop: 4, paddingBottom: 4, gap: 12 },
  serviceCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 10,
  },
  cardPressed: { opacity: 0.85 },
  serviceMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  serviceTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: FONT_SANS_EXTRABOLD },
  categoryChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  categoryChipText: { fontSize: 11, lineHeight: 14, fontFamily: FONT_SANS_BOLD, maxWidth: 120 },
  servicePrice: { fontSize: 18, lineHeight: 22, fontFamily: FONT_SANS_EXTRABOLD },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 260 },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4, paddingBottom: 8 },
  pageButton: { borderRadius: 10 },
  pageNextContent: { flexDirection: 'row-reverse' },
  pageInfo: { fontSize: 13, textAlign: 'center' },
});
