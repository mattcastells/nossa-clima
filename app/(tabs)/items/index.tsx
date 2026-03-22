import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Card, Chip, Menu, Searchbar, Text, TouchableRipple } from 'react-native-paper';

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
      <Searchbar
        placeholder="Buscar material"
        value={search}
        onChangeText={setSearch}
        inputStyle={styles.searchbarInput}
        style={[
          styles.searchbar,
          {
            backgroundColor: theme.dark ? '#2B3138' : theme.colors.surface,
            borderColor: theme.colors.borderSoft,
          },
        ]}
      />

      <View style={styles.topActions}>
        <Link href="/items/new" asChild style={styles.topActionItem}>
          <Button
            mode="contained-tonal"
            buttonColor={theme.colors.softGreen}
            textColor={theme.dark ? theme.colors.titleOnSoft : '#1A1A1A'}
            style={{ borderWidth: 1, borderColor: theme.dark ? theme.colors.softGreenStrong : BRAND_GREEN_MID, borderRadius: 8, flex: 1 }}
            contentStyle={styles.newButtonContent}
          >
            Nuevo material
          </Button>
        </Link>

        <Menu
          visible={categoryMenuOpen}
          onDismiss={() => setCategoryMenuOpen(false)}
          anchorPosition="bottom"
          contentStyle={[styles.menuContent, { width: menuWidth }]}
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
                <Text style={[styles.filterDropdownIcon, { color: filterChipTextColor }]}>☰</Text>
                <Text style={[styles.filterDropdownText, { color: filterChipTextColor }]} numberOfLines={1}>
                  {selectedCategoryLabel}
                </Text>
                <Text style={[styles.filterDropdownArrow, { color: filterChipTextColor }]}>▾</Text>
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
                  onPress={() => { setSelectedCategory(item.key); setCategoryMenuOpen(false); }}
                  style={[styles.menuGridItem, isSelected && styles.menuGridItemSelected]}
                  borderless
                >
                  <View style={styles.menuGridItemInner}>
                    {isSelected && <Text style={[styles.menuCheckIcon, { color: filterChipTextColor }]}>✓</Text>}
                    <Text style={[styles.menuGridItemText, isSelected && styles.menuGridItemTextSelected]} numberOfLines={1}>{item.label}</Text>
                  </View>
                </TouchableRipple>
              );
            })}
          </View>
        </Menu>
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
  searchbar: {
    borderRadius: 14,
    borderWidth: 1,
  },
  searchbarInput: {
    paddingLeft: 4,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  topActionItem: {
    flex: 1,
  },
  newButtonContent: {
    height: 42,
  },
  categoryRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterDropdown: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 0,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
  },
  filterDropdownInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  filterDropdownIcon: {
    fontSize: 13,
  },
  filterDropdownText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterDropdownArrow: {
    fontSize: 11,
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
    borderColor: '#D5D5D5',
    backgroundColor: '#FFFFFF',
  },
  menuGridItemSelected: {
    borderColor: '#C0D4B8',
    backgroundColor: '#E4EDE0',
  },
  menuGridItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  menuCheckIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  menuGridItemText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  menuGridItemTextSelected: {
    fontWeight: '700',
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: {
    fontWeight: '500',
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
