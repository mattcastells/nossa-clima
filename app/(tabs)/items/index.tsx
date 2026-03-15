import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Searchbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useItems } from '@/features/items/hooks';

const ALL_CATEGORIES = '__all__';

export default function ItemsScreen() {
  const { data, isLoading, error } = useItems();
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
        (item.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [materials, search, selectedCategory]);

  return (
    <AppScreen title="Materiales">
      <Searchbar placeholder="Buscar material" value={search} onChangeText={setSearch} style={styles.searchbar} />

      <View style={styles.topActions}>
        <Link href="/items/new" asChild>
          <Button mode="contained">Nuevo material</Button>
        </Link>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        <Chip selected={selectedCategory === ALL_CATEGORIES} onPress={() => setSelectedCategory(ALL_CATEGORIES)}>
          Todas
        </Chip>
        {categories.map((category) => (
          <Chip key={category} selected={selectedCategory === category} onPress={() => setSelectedCategory(category)}>
            {category}
          </Chip>
        ))}
      </ScrollView>
      <Text style={styles.helperText}>Las categorias se crean al guardar un material con una categoria nueva.</Text>

      <LoadingOrError isLoading={isLoading} error={error} />

      <FlatList
        data={filteredMaterials}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Link href={`/items/${item.id}`} asChild>
            <Card mode="outlined" style={styles.materialCard}>
              <View style={styles.headerBlock}>
                <View style={styles.headerMainRow}>
                  <Text style={styles.headerTitle}>{item.name}</Text>
                  <Chip compact style={styles.categoryChip} textStyle={styles.categoryChipText}>
                    {item.category ?? 'Sin categoria'}
                  </Chip>
                </View>
              </View>
              <Card.Content style={styles.materialCardContent}>
                {item.description ? <Text style={styles.description}>Descripcion: {item.description}</Text> : null}
                {item.notes ? <Text style={styles.description}>Notas: {item.notes}</Text> : null}
              </Card.Content>
            </Card>
          </Link>
        )}
        ListEmptyComponent={<Text>No hay materiales que coincidan con los filtros.</Text>}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchbar: {
    borderRadius: 14,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryRow: {
    gap: 8,
    paddingVertical: 2,
  },
  helperText: {
    color: '#5f6368',
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
    backgroundColor: '#F6F8FB',
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
    backgroundColor: '#DCD1EE',
    minHeight: 24,
  },
  categoryChipText: {
    fontSize: 11,
    lineHeight: 14,
  },
  description: {
    color: '#5f6368',
  },
});
