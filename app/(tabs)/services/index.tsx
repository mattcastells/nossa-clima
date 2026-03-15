import { Link } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Searchbar, Snackbar, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useImportDefaultServices, useServiceCategories, useServices } from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs } from '@/lib/format';

const ALL_CATEGORIES = '__all__';

export default function ServicesScreen() {
  const { data, isLoading, error } = useServices();
  const { data: categoryNames, isLoading: categoriesLoading, error: categoriesError } = useServiceCategories();
  const importDefaults = useImportDefaultServices();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [message, setMessage] = useState<string | null>(null);
  const autoImportTriggered = useRef(false);

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

  const categories = useMemo(() => categoryNames ?? [], [categoryNames]);

  useEffect(() => {
    if (selectedCategory === ALL_CATEGORIES) return;
    if (!categories.some((category) => category === selectedCategory)) {
      setSelectedCategory(ALL_CATEGORIES);
    }
  }, [categories, selectedCategory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((service) => {
      if (selectedCategory !== ALL_CATEGORIES && (service.category ?? '') !== selectedCategory) {
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
      <Searchbar placeholder="Buscar servicio" value={search} onChangeText={setSearch} style={styles.searchbar} />

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
        <Chip compact selected={selectedCategory === ALL_CATEGORIES} onPress={() => setSelectedCategory(ALL_CATEGORIES)}>
          Todas
        </Chip>
        {categories.map((category) => (
          <Chip compact key={category} selected={selectedCategory === category} onPress={() => setSelectedCategory(category)}>
            {category}
          </Chip>
        ))}
      </ScrollView>

      <LoadingOrError isLoading={isLoading || categoriesLoading} error={error ?? categoriesError} />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Link href={`/services/${item.id}`} asChild>
            <Card mode="outlined" style={styles.serviceCard}>
              <View style={styles.headerBlock}>
                <View style={styles.headerMainRow}>
                  <Text style={styles.headerTitle}>{item.name}</Text>
                  <Chip compact style={styles.categoryChip} textStyle={styles.categoryChipText}>
                    {item.category ?? 'Sin categoria'}
                  </Chip>
                </View>
              </View>
              <Card.Content style={styles.serviceContent}>
                <Text variant="titleSmall">{formatCurrencyArs(item.base_price)}</Text>
                {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
              </Card.Content>
            </Card>
          </Link>
        )}
        ListEmptyComponent={<Text>No hay servicios que coincidan con los filtros.</Text>}
      />

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  searchbar: {
    borderRadius: 14,
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
  listContent: {
    paddingBottom: 12,
  },
  serviceCard: {
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
