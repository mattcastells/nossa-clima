import { Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Card, Chip, Menu, Searchbar, Text, TouchableRipple } from 'react-native-paper';

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
      <Searchbar
        placeholder="Buscar servicio"
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
        <Link href="/services/new" asChild style={styles.topActionItem}>
          <Button
            mode="contained-tonal"
            buttonColor={theme.colors.softBlue}
            textColor={theme.dark ? theme.colors.titleOnSoft : '#1A1A1A'}
            style={{ borderWidth: 1, borderColor: filterChipBorderColor, borderRadius: 8, flex: 1 }}
            contentStyle={styles.newButtonContent}
          >
            Nuevo servicio
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
                  backgroundColor: theme.colors.softBlue,
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
            {[{ key: ALL_CATEGORIES, label: 'Todas' }, ...categories].map((item) => {
              const isSelected = selectedCategory === item.key;
              return (
                <TouchableRipple
                  key={item.key}
                  onPress={() => { setSelectedCategory(item.key); setCategoryMenuOpen(false); }}
                  style={[styles.menuGridItem, isSelected && styles.menuGridItemSelected]}
                  borderless
                >
                  <View style={styles.menuGridItemInner}>
                    {isSelected && (
                      <Text style={[styles.menuCheckIcon, { color: filterChipTextColor }]}>✓</Text>
                    )}
                    <Text
                      style={[styles.menuGridItemText, isSelected && styles.menuGridItemTextSelected]}
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
    borderColor: '#AECCE8',
    backgroundColor: '#E0EEF8',
  },
  menuGridItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuCheckIcon: {
    fontSize: 13,
    fontWeight: '700',
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
