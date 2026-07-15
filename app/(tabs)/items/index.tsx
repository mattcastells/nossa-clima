import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput as NativeTextInput, useWindowDimensions, View } from 'react-native';
import { Icon, IconButton, Menu, Text, TouchableRipple } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItemsWithStats } from '@/features/items/hooks';
import { formatItemDisplayName } from '@/lib/itemDisplay';
import type { ItemListStats } from '@/services/items';
import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, FONT_SANS_MEDIUM, useAppTheme } from '@/theme';

const ALL_CATEGORIES = '__all__';

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
  const { width: screenWidth } = useWindowDimensions();
  const menuWidth = screenWidth - 32;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  const materials = useMemo(() => (data ?? []).filter((item) => item.item_type === 'material'), [data]);

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
      }
    >
      <LoadingOrError isLoading={isLoading} error={error} />

      <FlatList
        data={filteredMaterials}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const secondary = buildItemSummary(item);
          return (
            <AnimatedEntrance delay={60 + index * 35} distance={12}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/items/${item.id}`)}
                style={({ pressed }) => [
                  styles.materialCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={styles.materialHeader}>
                  <Text style={[styles.materialTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={2}>
                    {formatItemDisplayName(item)}
                  </Text>
                  <View style={[styles.categoryChip, { backgroundColor: theme.colors.softGreen }]}>
                    <Text style={[styles.categoryChipText, { color: theme.colors.toastSuccessText }]} numberOfLines={1}>
                      {item.category ?? 'Sin categoría'}
                    </Text>
                  </View>
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
