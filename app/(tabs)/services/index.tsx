import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Searchbar, Text } from 'react-native-paper';

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
  const filterChipTextColor = theme.dark ? theme.colors.titleOnSoft : BRAND_BLUE;
  const filterChipBorderColor = theme.dark ? theme.colors.softBlueStrong : BRAND_BLUE_MID;
  const { data: categoryNames, isLoading: categoriesLoading, error: categoriesError } = useServiceCategories();
  const importDefaults = useImportDefaultServices();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
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
        inputStyle={styles.searchInput}
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <Chip
          compact
          selected={selectedCategory === ALL_CATEGORIES}
          selectedColor={filterChipTextColor}
          style={StyleSheet.flatten([
            styles.filterChip,
            {
              backgroundColor: selectedCategory === ALL_CATEGORIES ? theme.colors.softBlueStrong : theme.colors.softBlue,
              borderColor: filterChipBorderColor,
            },
          ])}
          textStyle={StyleSheet.flatten([styles.filterChipText, { color: filterChipTextColor }])}
          onPress={() => setSelectedCategory(ALL_CATEGORIES)}
        >
          Todas
        </Chip>
        {categories.map((category) => (
          <Chip
            compact
            key={category.key}
            selected={selectedCategory === category.key}
            selectedColor={filterChipTextColor}
            style={StyleSheet.flatten([
              styles.filterChip,
              {
                backgroundColor: selectedCategory === category.key ? theme.colors.softBlueStrong : theme.colors.softBlue,
                borderColor: filterChipBorderColor,
              },
            ])}
            textStyle={StyleSheet.flatten([styles.filterChipText, { color: filterChipTextColor }])}
            onPress={() => setSelectedCategory(category.key)}
          >
            {category.label}
          </Chip>
        ))}
      </ScrollView>

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
  searchInput: {
    paddingLeft: 6,
    paddingRight: 10,
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
