import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Searchbar, Text } from 'react-native-paper';

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
  const filterChipTextColor = theme.dark ? theme.colors.titleOnSoft : BRAND_GREEN;
  const filterChipBorderColor = theme.dark ? theme.colors.softGreenStrong : BRAND_GREEN_MID;
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);

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
        <Link href="/items/new" asChild>
          <Button mode="contained">Nuevo material</Button>
        </Link>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <Chip
          selected={selectedCategory === ALL_CATEGORIES}
          selectedColor={filterChipTextColor}
          style={StyleSheet.flatten([
            styles.filterChip,
            {
              backgroundColor: selectedCategory === ALL_CATEGORIES ? theme.colors.softGreenStrong : theme.colors.softGreen,
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
            key={category}
            selected={selectedCategory === category}
            selectedColor={filterChipTextColor}
            style={StyleSheet.flatten([
              styles.filterChip,
              {
                backgroundColor: selectedCategory === category ? theme.colors.softGreenStrong : theme.colors.softGreen,
                borderColor: filterChipBorderColor,
              },
            ])}
            textStyle={StyleSheet.flatten([styles.filterChipText, { color: filterChipTextColor }])}
            onPress={() => setSelectedCategory(category)}
          >
            {category}
          </Chip>
        ))}
      </ScrollView>
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
                    <Text style={[styles.headerTitle, { color: theme.colors.titleOnSoft }]}>{formatItemDisplayName(item)}</Text>
                    <Chip
                      compact
                      style={StyleSheet.flatten([
                        styles.categoryChip,
                        {
                          backgroundColor: theme.colors.softGreenStrong,
                          borderColor: filterChipBorderColor,
                        },
                      ])}
                      textStyle={StyleSheet.flatten([styles.categoryChipText, { color: theme.colors.titleOnSoft }])}
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
  searchInput: {
    paddingLeft: 6,
    paddingRight: 10,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryRow: {
    gap: 8,
    paddingVertical: 2,
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
