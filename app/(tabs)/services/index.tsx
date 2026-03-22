import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, Card, Chip, Menu, Searchbar, Text, TouchableRipple } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useImportDefaultServices, useServiceCategories, useServices } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs } from '@/lib/format';
import { BRAND_BLUE, BRAND_BLUE_MID, useAppTheme } from '@/theme';

const ALL_CATEGORIES = '__all__';
const UNCATEGORIZED_CATEGORY = '__uncategorized__';
type ServiceCategoryOption = {
  key: string;
  label: string;
};

export default function ServicesScreen() {
  const { data, isLoading, error } = useServices();
  const theme = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const menuWidth = screenWidth - 32;
  const filterChipTextColor = theme.dark ? theme.colors.titleOnSoft : BRAND_BLUE;
  const filterChipBorderColor = theme.dark ? theme.colors.softBlueStrong : BRAND_BLUE_MID;
  const { data: categoryNames, isLoading: categoriesLoading, error: categoriesError } = useServiceCategories();
  const importDefaults = useImportDefaultServices();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const autoImportTriggered = useRef(false);
  useToastMessageEffect(message, () => setMessage(null));

  useEffect(() => {
    if (autoImportTriggered.current || isLoading || importDefaults.isPending || Boolean(error)) return;
    autoImportTriggered.current = true;

    importDefaults.mutate(undefined, {
      onSuccess: (result) => {
        if (result.inserted > 0) {
          setMessage(`Se cargaron ${result.inserted} servicios base.`);
        }
      },
      onError: (mutationError) => {
        setMessage(toUserErrorMessage(mutationError, 'No se pudo cargar la lista base.'));
      },
    });
  }, [data, error, importDefaults, isLoading]);

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
        if (normalizedCategory.length > 0) {
          return false;
        }
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

  return (
    <AppScreen title="Servicios">
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
        <Link href="/services/new" asChild>
          <Button mode="contained">Nuevo servicio</Button>
        </Link>
        <Link href="/services/categories" asChild>
          <Button mode="outlined">
            Categorias
          </Button>
        </Link>
      </View>

      <View style={styles.filterRow}>
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
            {[{ key: ALL_CATEGORIES, label: 'Todas' }, ...categories].map((item, idx, arr) => {
              const lastRowStart = arr.length % 2 === 0 ? arr.length - 2 : arr.length - 1;
              const isLastRow = idx >= lastRowStart;
              return (
                <TouchableRipple
                  key={item.key}
                  onPress={() => { setSelectedCategory(item.key); setCategoryMenuOpen(false); }}
                  style={[styles.menuGridItem, !isLastRow && styles.menuGridItemBorder, idx % 2 === 0 && styles.menuGridItemLeft]}
                >
                  <View style={styles.menuGridItemInner}>
                    {selectedCategory === item.key && <Text style={[styles.menuCheckIcon, { color: filterChipTextColor }]}>✓</Text>}
                    <Text style={[styles.menuGridItemText, selectedCategory === item.key && styles.menuGridItemTextSelected]} numberOfLines={1}>{item.label}</Text>
                  </View>
                </TouchableRipple>
              );
            })}
          </View>
        </Menu>
      </View>

      <LoadingOrError isLoading={isLoading || categoriesLoading} error={error ?? categoriesError} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <AnimatedEntrance delay={90 + index * 40} distance={12}>
            <Link href={`/services/${item.id}`} asChild>
              <Card mode="outlined" style={styles.serviceCard}>
                <View style={[styles.headerBlock, { backgroundColor: theme.colors.softBlue }]}>
                  <View style={styles.headerMainRow}>
                    <Text style={[styles.headerTitle, { color: theme.colors.titleOnSoft }]}>{item.name}</Text>
                    <Chip
                      compact
                      style={StyleSheet.flatten([
                        styles.categoryChip,
                        {
                          backgroundColor: theme.colors.softBlueStrong,
                          borderColor: filterChipBorderColor,
                        },
                      ])}
                      textStyle={StyleSheet.flatten([styles.categoryChipText, { color: theme.colors.titleOnSoft }])}
                    >
                      {item.category ?? 'Sin categoria'}
                    </Chip>
                  </View>
                </View>
              <Card.Content style={styles.serviceContent}>
                <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>{formatCurrencyArs(item.base_price)}</Text>
                {item.description ? <Text style={[styles.description, { color: theme.colors.textMuted }]}>{item.description}</Text> : null}
              </Card.Content>
            </Card>
            </Link>
          </AnimatedEntrance>
        )}
        ListEmptyComponent={<Text>No hay servicios que coincidan con los filtros.</Text>}
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
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryRow: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
  },
  filterDropdownInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterDropdownIcon: {
    fontSize: 14,
  },
  filterDropdownText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  filterDropdownArrow: {
    fontSize: 12,
    marginLeft: 2,
  },
  menuContent: {
    paddingVertical: 4,
  },
  menuWrapper: {
    flex: 1,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
  },
  menuGridItem: {
    width: '50%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderColor: '#D5D5D5',
  },
  menuGridItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuGridItemLeft: {
    borderRightWidth: StyleSheet.hairlineWidth,
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
    flex: 1,
  },
  menuGridItemTextSelected: {
    fontWeight: '600',
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipText: {
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 12,
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
  serviceContent: {
    gap: 8,
    paddingTop: 12,
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
  description: {
    color: '#5f6368',
  },
});
