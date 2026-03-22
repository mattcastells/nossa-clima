import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Searchbar, Text } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useStores } from '@/features/stores/hooks';
import { BRAND_YELLOW, useAppTheme } from '@/theme';

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
      <Searchbar
        placeholder="Buscar tienda"
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
        <Link href="/stores/new" asChild>
          <Button mode="contained-tonal" buttonColor={theme.colors.softYellow} textColor={theme.dark ? theme.colors.titleOnSoft : BRAND_YELLOW}>
            Nueva tienda
          </Button>
        </Link>
      </View>

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
                  <Text style={[styles.headerTitle, { color: theme.colors.titleOnSoft }]}>{item.name}</Text>
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
  searchbar: {
    borderRadius: 14,
    borderWidth: 1,
  },
  searchbarInput: {
    paddingLeft: 4,
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
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
