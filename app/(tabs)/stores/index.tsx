import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { ActionSearchComposer } from '@/components/ActionSearchComposer';
import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useStores } from '@/features/stores/hooks';
import { useAppTheme } from '@/theme';

export default function StoresScreen() {
  const { data, isLoading, error } = useStores();
  const theme = useAppTheme();
  const [search, setSearch] = useState('');

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((store) => {
      if (!q) return true;
      return (
        store.name.toLowerCase().includes(q) ||
        (store.address ?? '').toLowerCase().includes(q) ||
        (store.phone ?? '').toLowerCase().includes(q) ||
        (store.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, search]);

  return (
    <AppScreen title="Tiendas">
      <ActionSearchComposer
        actionLabel="Nueva"
        actionAccessibilityLabel="Nueva tienda"
        onActionPress={() => router.push('/stores/new')}
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar tienda..."
        searchAccessibilityLabel="Buscar tienda"
        accentBackgroundColor={theme.colors.softYellow}
        accentBorderColor={theme.colors.softYellowStrong}
        accentTextColor={theme.colors.onSoftYellow}
      />

      <LoadingOrError isLoading={isLoading} error={error} />

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <AnimatedEntrance delay={80 + index * 40} distance={12}>
            <Link href={`/stores/${item.id}`} asChild>
              <Card mode="outlined" style={styles.storeCard}>
                <View style={[styles.headerBlock, { backgroundColor: theme.colors.softYellow }]}>
                  <Text style={[styles.headerTitle, { color: theme.colors.onSoftYellow }]}>{item.name}</Text>
                </View>
                <Card.Content style={styles.storeCardContent}>
                  {item.address ? <Text style={{ color: theme.colors.onSurface }}>Ubicacion: {item.address}</Text> : null}
                  {item.phone ? <Text style={{ color: theme.colors.onSurface }}>Telefono: {item.phone}</Text> : null}
                </Card.Content>
              </Card>
            </Link>
          </AnimatedEntrance>
        )}
        ListEmptyComponent={<Text>No hay tiendas que coincidan con los filtros.</Text>}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 12,
  },
  storeCard: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerBlock: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 9,
  },
  headerTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  storeCardContent: {
    gap: 4,
    paddingTop: 12,
  },
});
