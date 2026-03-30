import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Card, Chip, Icon, Menu, Text, TouchableRipple } from 'react-native-paper';

import { ActionSearchComposer } from '@/components/ActionSearchComposer';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems } from '@/features/items/hooks';
import { formatItemDisplayName } from '@/lib/itemDisplay';
import { BRAND_GREEN, BRAND_GREEN_MID, useAppTheme } from '@/theme';

const ALL_CATEGORIES = '__all__';

export default function ItemsScreen() {
  const { data, isLoading, error } = useItems();
  const theme = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const menuWidth = screenWidth - 32;
  const filterChipTextColor = theme.dark ? theme.colors.titleOnSoft : '#1A1A1A';
  const filterChipBorderColor = theme.dark ? theme.colors.softGreenStrong : BRAND_GREEN_MID;
  const menuItemBackgroundColor = theme.dark ? theme.colors.surface : '#FFFFFF';
  const menuItemBorderColor = theme.dark ? theme.colors.borderSoft : '#D5D5D5';
  const menuItemSelectedBackgroundColor = theme.dark ? theme.colors.softGreen : '#E4EDE0';
  const menuItemSelectedBorderColor = theme.dark ? theme.colors.softGreenStrong : '#C0D4B8';
  const menuItemTextColor = theme.dark ? theme.colors.onSurface : '#1A1A1A';
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);

  const materials = useMemo(() => (data ?? []).filter((item) => item.item_type === 'material'), [data]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          materials
            .map((item) => item.category?.trim() ?? '')
            .filter((category) => category.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [materials],
  );

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES) return 'Todas';
    return selectedCategory;
  }, [selectedCategory]);

  const filteredMaterials = useMemo(() => {
    const q = search.trim().toLowerCase();

    return materials.filter((item) => {
      if (selectedCategory !== ALL_CATEGORIES && (item.category ?? '') !== selectedCategory) {
        return false;
      }

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
    <AppScreen title="Materiales">
      <ActionSearchComposer
        actionLabel="Nuevo"
        actionAccessibilityLabel="Nuevo material"
        onActionPress={() => router.push('/items/new')}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar material..."
        searchAccessibilityLabel="Buscar material"
        accentBackgroundColor={theme.colors.softGreen}
        accentBorderColor={filterChipBorderColor}
        accentTextColor={theme.dark ? theme.colors.titleOnSoft : '#1A1A1A'}
      />

      <View style={styles.filtersRow}>
        <View style={styles.menuAnchorWrapper}>
          <Menu
            visible={categoryMenuOpen}
            onDismiss={() => setCategoryMenuOpen(false)}
            anchorPosition="bottom"
            contentStyle={[styles.menuContent, { width: menuWidth, backgroundColor: theme.colors.surfaceAlt }]}
            style={styles.menuWrapper}
            anchor={
              <TouchableRipple
                onPress={() => setCategoryMenuOpen(true)}
                style={[
                  styles.filterDropdown,
                  {
                    backgroundColor: theme.colors.softGreen,
                    borderColor: filterChipBorderColor,
                  },
                ]}
                borderless
              >
                <View style={styles.filterDropdownInner}>
                  <Icon source="menu" size={16} color={filterChipTextColor} />
                  <Text style={[styles.filterDropdownText, { color: filterChipTextColor }]} numberOfLines={1}>
                    {selectedCategoryLabel}
                  </Text>
                  <Icon source="chevron-down" size={16} color={filterChipTextColor} />
                </View>
              </TouchableRipple>
            }
          >
            <View style={styles.menuGrid}>
              {[{ key: ALL_CATEGORIES, label: 'Todas' }, ...categories.map((category) => ({ key: category, label: category }))].map((item) => {
                const isSelected = selectedCategory === item.key;
                return (
                  <TouchableRipple
                    key={item.key}
                    onPress={() => {
                      setSelectedCategory(item.key);
                      setCategoryMenuOpen(false);
                    }}
                    style={[
                      styles.menuGridItem,
                      {
                        backgroundColor: menuItemBackgroundColor,
                        borderColor: menuItemBorderColor,
                      },
                      isSelected && {
                        backgroundColor: menuItemSelectedBackgroundColor,
                        borderColor: menuItemSelectedBorderColor,
                      },
                    ]}
                    borderless
                  >
                    <View style={styles.menuGridItemInner}>
                      {isSelected ? <Icon source="check" size={14} color={filterChipTextColor} /> : null}
                      <Text
                        style={[
                          styles.menuGridItemText,
                          { color: menuItemTextColor },
                          isSelected && styles.menuGridItemTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                    </View>
                  </TouchableRipple>
                );
              })}
            </View>
          </Menu>
        </View>
      </View>

      <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>Las categorias se crean al guardar un material con una categoria nueva.</Text>

      <LoadingOrError isLoading={isLoading} error={error} />

      <FlatList
        data={filteredMaterials}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <AnimatedEntrance delay={90 + index * 40} distance={12}>
            <Link href={`/items/${item.id}`} asChild>
              <Card mode="outlined" style={styles.materialCard}>
                <View style={[styles.headerBlock, { backgroundColor: theme.colors.softGreen }]}>
                  <View style={styles.headerMainRow}>
                    <Text style={[styles.headerTitle, { color: theme.dark ? theme.colors.titleOnSoft : '#1A1A1A' }]}>{formatItemDisplayName(item)}</Text>
                    <Chip
                      compact
                      style={StyleSheet.flatten([
                        styles.categoryChip,
                        {
                          backgroundColor: theme.colors.softGreenStrong,
                          borderColor: filterChipBorderColor,
                        },
                      ])}
                      textStyle={StyleSheet.flatten([styles.categoryChipText, { color: theme.dark ? theme.colors.titleOnSoft : '#1A1A1A' }])}
                    >
                      {item.category ?? 'Sin categoria'}
                    </Chip>
                  </View>
                </View>
                <Card.Content style={styles.materialCardContent}>
                  {item.base_price_label ? <Text style={[styles.presentationText, { color: theme.colors.textMuted }]}>Base calculada: {item.base_price_label}</Text> : null}
                  {item.description ? <Text style={[styles.description, { color: theme.colors.textMuted }]}>{item.description}</Text> : null}
                  {item.notes ? <Text style={[styles.description, { color: theme.colors.textMuted }]}>Notas: {item.notes}</Text> : null}
                </Card.Content>
              </Card>
            </Link>
          </AnimatedEntrance>
        )}
        ListEmptyComponent={<Text>No hay materiales que coincidan con los filtros.</Text>}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    width: '100%',
  },
  menuAnchorWrapper: {
    width: '100%',
  },
  filterDropdown: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 0,
    width: '100%',
    justifyContent: 'center',
    minHeight: 42,
  },
  filterDropdownInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filterDropdownText: {
    fontSize: 14,
    fontWeight: '500',
  },
  menuContent: {
    paddingVertical: 6,
    borderRadius: 12,
  },
  menuWrapper: {
    flex: 1,
  },
  menuGrid: {
    flexDirection: 'column',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  menuGridItem: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  menuGridItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  menuGridItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  menuGridItemTextSelected: {
    fontWeight: '700',
  },
  helperText: {
    marginTop: -6,
  },
  listContent: {
    paddingBottom: 12,
  },
  materialCard: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerBlock: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
  },
  headerMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    flex: 1,
  },
  materialCardContent: {
    gap: 6,
    paddingTop: 12,
  },
  categoryChip: {
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 24,
  },
  categoryChipText: {
    fontSize: 11,
    lineHeight: 14,
    color: BRAND_GREEN,
  },
  description: {
    color: '#5f6368',
  },
  presentationText: {
    fontWeight: '500',
  },
});
