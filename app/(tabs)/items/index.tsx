import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput as NativeTextInput, useWindowDimensions, View } from 'react-native';
import { Icon, IconButton, Menu, Text, TouchableRipple } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { useAppToast } from '@/components/AppToastProvider';
import { CatalogSwitcher } from '@/components/CatalogSwitcher';
import { LoadingOrError } from '@/components/LoadingOrError';
import { SelectionCheck, SelectionModeBar } from '@/components/SelectionModeBar';
import { getCategoryAccent } from '@/features/items/categoryAccent';
import { useArchiveItems, useItemsWithStats } from '@/features/items/hooks';
import { ConfirmDeleteDialog } from '@/features/quotes/components/ConfirmDeleteDialog';
import { toUserErrorMessage } from '@/lib/errors';
import { formatItemDisplayName } from '@/lib/itemDisplay';
import type { ItemListStats } from '@/services/items';
import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, FONT_SANS_MEDIUM, useAppTheme } from '@/theme';

const ALL_CATEGORIES = '__all__';

/** trim + minúsculas + espacios colapsados, para detectar repetidos. */
const normalizeName = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const pluralize = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

/** "2 medidas · precio en 2 tiendas" / "Precio directo · 3 tiendas" */
const buildItemSummary = ({ measurementCount, storeCount }: ItemListStats): string => {
  const stores = storeCount > 0 ? `precio en ${pluralize(storeCount, 'tienda', 'tiendas')}` : 'sin precios';
  if (measurementCount > 0) return `${pluralize(measurementCount, 'medida', 'medidas')} · ${stores}`;
  return storeCount > 0 ? `Precio directo · ${pluralize(storeCount, 'tienda', 'tiendas')}` : 'Sin precios cargados';
};

export default function ItemsScreen() {
  const { data, isLoading, error } = useItemsWithStats();
  const theme = useAppTheme();
  const toast = useAppToast();
  const archiveItems = useArchiveItems();
  const { width: screenWidth } = useWindowDimensions();
  const menuWidth = screenWidth - 32;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const selectionMode = selectedIds.length > 0;

  const materials = useMemo(() => (data ?? []).filter((item) => item.item_type === 'material'), [data]);

  /** Nombres que aparecen más de una vez: son los que hay que limpiar. */
  const duplicatedNames = useMemo(() => {
    const counts = new Map<string, number>();
    materials.forEach((item) => {
      const key = normalizeName(item.name);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key));
  }, [materials]);

  const toggleSelected = useCallback((itemId: string) => {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }, []);

  const archiveSelected = async () => {
    try {
      const count = await archiveItems.mutateAsync(selectedIds);
      toast.success(count === 1 ? 'Material archivado.' : `${count} materiales archivados.`);
      setSelectedIds([]);
      setConfirmArchive(false);
    } catch (archiveError) {
      toast.error(toUserErrorMessage(archiveError, 'No se pudieron archivar los materiales.'));
      setConfirmArchive(false);
    }
  };

  const categories = useMemo(
    () =>
      Array.from(
        new Set(materials.map((item) => item.category?.trim() ?? '').filter((category) => category.length > 0)),
      ).sort((a, b) => a.localeCompare(b)),
    [materials],
  );

  const selectedCategoryLabel = selectedCategory === ALL_CATEGORIES ? 'Todas' : selectedCategory;

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materials.filter((item) => {
      if (selectedCategory !== ALL_CATEGORIES && (item.category ?? '') !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.notes ?? '').toLowerCase().includes(q) ||
        (item.category ?? '').toLowerCase().includes(q) ||
        (item.base_price_label ?? '').toLowerCase().includes(q)
      );
    });
  }, [materials, search, selectedCategory]);

  return (
    <AppScreen
      title="Materiales"
      titleRight={
        <IconButton
          icon="plus"
          mode="contained"
          size={22}
          accessibilityLabel="Nuevo material"
          containerColor={theme.colors.accent}
          iconColor={theme.colors.onAccent}
          style={styles.newButton}
          onPress={() => router.push('/items/new')}
        />
      }
      headerContent={
      <>
      <CatalogSwitcher active="items" />
      <View style={styles.toolsRow}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Icon source="magnify" size={20} color={theme.colors.textMuted} />
          <NativeTextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar material"
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
              style={[styles.filterChip, { backgroundColor: theme.colors.softGreen, borderColor: theme.colors.softGreenStrong }]}
              borderless
            >
              <View style={styles.filterChipInner}>
                <Text style={[styles.filterChipText, { color: theme.colors.toastSuccessText }]} numberOfLines={1}>
                  {selectedCategoryLabel}
                </Text>
                <Icon source="chevron-down" size={16} color={theme.colors.toastSuccessText} />
              </View>
            </TouchableRipple>
          }
        >
          <View style={styles.menuGrid}>
            {[{ key: ALL_CATEGORIES, label: 'Todas' }, ...categories.map((c) => ({ key: c, label: c }))].map((item) => {
              const isSelected = selectedCategory === item.key;
              return (
                <TouchableRipple
                  key={item.key}
                  onPress={() => {
                    setSelectedCategory(item.key);
                    setCategoryMenuOpen(false);
                  }}
                  style={[
                    styles.menuItem,
                    { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
                    isSelected && { backgroundColor: theme.colors.softGreen, borderColor: theme.colors.softGreenStrong },
                  ]}
                  borderless
                >
                  <View style={styles.menuItemInner}>
                    {isSelected ? <Icon source="check" size={14} color={theme.colors.toastSuccessText} /> : null}
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
      </>
      }
    >
      <LoadingOrError isLoading={isLoading} error={error} />

      {selectionMode ? (
        <SelectionModeBar
          count={selectedIds.length}
          itemLabel="material"
          onCancel={() => setSelectedIds([])}
          onArchive={() => setConfirmArchive(true)}
          loading={archiveItems.isPending}
        />
      ) : null}

      <FlatList
        data={filteredMaterials}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const secondary = buildItemSummary(item);
          const selected = selectedIds.includes(item.id);
          const isDuplicated = duplicatedNames.has(normalizeName(item.name));

          return (
            <AnimatedEntrance delay={60 + index * 35} distance={12}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                // Con el modo selección activo, tocar suma/saca de la selección
                // en vez de navegar: es lo que se espera al estar limpiando.
                onPress={() => (selectionMode ? toggleSelected(item.id) : router.push(`/items/${item.id}`))}
                onLongPress={() => toggleSelected(item.id)}
                delayLongPress={280}
                style={({ pressed }) => [
                  styles.materialCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
                  selected && { borderColor: theme.colors.accentStrong, borderWidth: 2 },
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.materialHeader}>
                  {selectionMode ? <SelectionCheck selected={selected} /> : null}
                  <Text style={[styles.materialTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={2}>
                    {formatItemDisplayName(item)}
                  </Text>
                  {isDuplicated ? (
                    <View style={[styles.duplicateChip, { backgroundColor: theme.colors.softYellow }]}>
                      <Text style={[styles.duplicateChipText, { color: theme.colors.onSoftYellow }]}>Repetido</Text>
                    </View>
                  ) : null}
                  {(() => {
                    const accent = getCategoryAccent(theme, item.category);
                    return (
                      <View style={[styles.categoryChip, { backgroundColor: accent.backgroundColor }]}>
                        <Text style={[styles.categoryChipText, { color: accent.textColor }]} numberOfLines={1}>
                          {item.category ?? 'Sin categoría'}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                {secondary ? (
                  <Text style={[styles.materialMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {secondary}
                  </Text>
                ) : null}
              </Pressable>
            </AnimatedEntrance>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon source="cube-outline" size={40} color={theme.colors.borderSoft} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {search.trim() || selectedCategory !== ALL_CATEGORIES ? 'No hay materiales que coincidan.' : 'Todavía no hay materiales. Agregá uno nuevo.'}
            </Text>
          </View>
        }
      />

      <ConfirmDeleteDialog
        visible={confirmArchive}
        title={selectedIds.length === 1 ? 'Archivar material' : `Archivar ${selectedIds.length} materiales`}
        message="Dejan de aparecer al cargar un trabajo. Los trabajos y los informes ya emitidos no se tocan."
        confirmLabel="Archivar"
        loading={archiveItems.isPending}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={archiveSelected}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  newButton: { margin: 0, borderRadius: 13 },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  searchBar: {
    flex: 1,
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
  filterChip: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  filterChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterChipText: {
    fontSize: 14,
    fontFamily: FONT_SANS_BOLD,
    maxWidth: 120,
  },
  menuContent: {
    paddingVertical: 6,
    borderRadius: 14,
  },
  menuGrid: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  menuItem: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  menuItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuItemText: {
    fontSize: 14,
    fontFamily: FONT_SANS_MEDIUM,
  },
  menuItemTextSelected: {
    fontFamily: FONT_SANS_EXTRABOLD,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 12,
    gap: 12,
  },
  materialCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    gap: 8,
  },
  cardPressed: {
    opacity: 0.85,
  },
  materialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  materialTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: FONT_SANS_EXTRABOLD,
  },
  categoryChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  duplicateChip: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  duplicateChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT_SANS_BOLD,
  },
  categoryChipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: FONT_SANS_BOLD,
    maxWidth: 120,
  },
  materialMeta: {
    fontSize: 13,
    lineHeight: 17,
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
});
