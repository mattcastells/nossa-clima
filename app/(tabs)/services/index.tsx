import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Card, Chip, Icon, Menu, Text, TouchableRipple } from 'react-native-paper';

import { ActionSearchComposer } from '@/components/ActionSearchComposer';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useServiceCategories, useServices } from '@/features/services/hooks';
import { formatCurrencyArs } from '@/lib/format';
import { BRAND_BLUE, BRAND_BLUE_MID, useAppTheme } from '@/theme';

const ALL_CATEGORIES = '__all__';
const UNCATEGORIZED_CATEGORY = '__uncategorized__';
const PAGE_SIZE = 10;

type ServiceCategoryOption = {
  key: string;
  label: string;
};

export default function ServicesScreen() {
  const { data, isLoading, error } = useServices();
  const theme = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const menuWidth = screenWidth - 32;
  const filterChipTextColor = theme.dark ? theme.colors.titleOnSoft : '#1A1A1A';
  const filterChipBorderColor = theme.dark ? theme.colors.softBlueStrong : BRAND_BLUE_MID;
  const menuItemBackgroundColor = theme.dark ? theme.colors.surface : '#FFFFFF';
  const menuItemBorderColor = theme.dark ? theme.colors.borderSoft : '#D5D5D5';
  const menuItemSelectedBackgroundColor = theme.dark ? theme.colors.softBlue : '#E0EEF8';
  const menuItemSelectedBorderColor = theme.dark ? theme.colors.softBlueStrong : '#AECCE8';
  const menuItemTextColor = theme.dark ? theme.colors.onSurface : '#1A1A1A';
  const { data: categoryNames, isLoading: categoriesLoading, error: categoriesError } = useServiceCategories();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const uncategorizedCount = useMemo(
    () =>
      (data ?? []).filter((service) => {
        const normalized = service.category?.trim() ?? '';
        return normalized.length === 0;
      }).length,
    [data],
  );

  const categories = useMemo<ServiceCategoryOption[]>(() => {
    const baseCategories = (categoryNames ?? []).map((category) => ({
      key: category,
      label: category,
    }));
    if (uncategorizedCount > 0) {
      baseCategories.push({
        key: UNCATEGORIZED_CATEGORY,
        label: 'Sin categorias',
      });
    }
    return baseCategories;
  }, [categoryNames, uncategorizedCount]);

  useEffect(() => {
    if (selectedCategory === ALL_CATEGORIES) return;
    if (selectedCategory === UNCATEGORIZED_CATEGORY) {
      if (uncategorizedCount === 0) {
        setSelectedCategory(ALL_CATEGORIES);
      }
      return;
    }
    if (!categories.some((category) => category.key === selectedCategory)) {
      setSelectedCategory(ALL_CATEGORIES);
    }
  }, [categories, selectedCategory, uncategorizedCount]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

  const selectedCategoryLabel = useMemo(() => {
    if (selectedCategory === ALL_CATEGORIES) return 'Todas';
    const found = categories.find((c) => c.key === selectedCategory);
    return found?.label ?? 'Todas';
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
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const categoriesButton = (
    <Link href="/services/categories" asChild>
      <Button
        mode="contained-tonal"
        compact
        buttonColor={theme.colors.softBlue}
        textColor={theme.dark ? theme.colors.titleOnSoft : '#1A1A1A'}
        style={{ borderWidth: 1, borderColor: filterChipBorderColor, borderRadius: 20 }}
        labelStyle={{ fontSize: 11, marginHorizontal: 8, marginVertical: 4 }}
      >
        Categorias
      </Button>
    </Link>
  );

  return (
    <AppScreen title="Servicios" titleRight={categoriesButton}>
      <ActionSearchComposer
        actionLabel="Nuevo"
        actionAccessibilityLabel="Nuevo servicio"
        onActionPress={() => router.push('/services/new')}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar servicio..."
        searchAccessibilityLabel="Buscar servicio"
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
                    backgroundColor: theme.colors.softBlue,
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
              {[{ key: ALL_CATEGORIES, label: 'Todas' }, ...categories].map((item) => {
                const isSelected = selectedCategory === item.key;
                return (
                  <TouchableRipple
                    key={item.key}
                    onPress={() => { setSelectedCategory(item.key); setCategoryMenuOpen(false); }}
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

      <LoadingOrError isLoading={isLoading || categoriesLoading} error={error ?? categoriesError} />

      <FlatList
        data={paginated}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
        renderItem={({ item, index }) => (
          <AnimatedEntrance delay={90 + index * 40} distance={12}>
            <Link href={`/services/${item.id}`} asChild>
              <Card mode="outlined" style={styles.serviceCard}>
                <View style={[styles.headerBlock, { backgroundColor: theme.colors.softBlue }]}>
                  <View style={styles.headerMainRow}>
                    <Text style={[styles.headerTitle, { color: theme.dark ? theme.colors.titleOnSoft : '#1A1A1A' }]}>{item.name}</Text>
                    <Chip
                      compact
                      style={StyleSheet.flatten([
                        styles.categoryChip,
                        {
                          backgroundColor: theme.colors.softBlueStrong,
                          borderColor: filterChipBorderColor,
                        },
                      ])}
                      textStyle={StyleSheet.flatten([styles.categoryChipText, { color: theme.dark ? theme.colors.titleOnSoft : '#1A1A1A' }])}
                    >
                      {item.category ?? 'Sin categoria'}
                    </Chip>
                  </View>
                </View>
                <Card.Content style={styles.serviceContent}>
                  <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
                    {formatCurrencyArs(item.base_price)}
                  </Text>
                  {item.description ? (
                    <Text style={[styles.description, { color: theme.colors.textMuted }]}>
                      {item.description}
                    </Text>
                  ) : null}
                </Card.Content>
              </Card>
            </Link>
          </AnimatedEntrance>
        )}
        ListEmptyComponent={
          <Text style={{ color: theme.colors.textMuted }}>
            No hay servicios que coincidan con los filtros.
          </Text>
        }
      />

      {filtered.length > 0 && (
        <View style={styles.paginationRow}>
          <Button
            mode="outlined"
            compact
            icon="chevron-left"
            disabled={currentPage === 1}
            onPress={() => setCurrentPage((p) => p - 1)}
            style={styles.pageButton}
          >
            Anterior
          </Button>
          <Text style={[styles.pageInfo, { color: theme.colors.textMuted }]}>
            {`${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} de ${filtered.length}`}
          </Text>
          <Button
            mode="outlined"
            compact
            contentStyle={{ flexDirection: 'row-reverse' }}
            icon="chevron-right"
            disabled={currentPage >= totalPages}
            onPress={() => setCurrentPage((p) => p + 1)}
            style={styles.pageButton}
          >
            Siguiente
          </Button>
        </View>
      )}
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
    gap: 6,
  },
  menuGridItemText: {
    fontSize: 14,
  },
  menuGridItemTextSelected: {
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 4,
  },
  serviceCard: {
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
  categoryChip: {
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 24,
  },
  categoryChipText: {
    fontSize: 11,
    lineHeight: 14,
    color: BRAND_BLUE,
  },
  serviceContent: {
    gap: 8,
    paddingTop: 12,
  },
  description: {
    color: '#5f6368',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 8,
  },
  pageButton: {
    borderRadius: 8,
  },
  pageInfo: {
    fontSize: 13,
    textAlign: 'center',
  },
});
