import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput as NativeTextInput, View } from 'react-native';
import { Icon, IconButton, Text } from 'react-native-paper';

import { AnimatedEntrance } from '@/components/AnimatedEntrance';
import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useStores } from '@/features/stores/hooks';
import { FONT_SANS_EXTRABOLD, useAppTheme } from '@/theme';

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
    <AppScreen
      title="Tiendas"
      titleRight={
        <IconButton
          icon="plus"
          mode="contained"
          size={22}
          accessibilityLabel="Nueva tienda"
          containerColor={theme.colors.accent}
          iconColor={theme.colors.onAccent}
          style={styles.newButton}
          onPress={() => router.push('/stores/new')}
        />
      }
    >
      <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
        <Icon source="magnify" size={20} color={theme.colors.textMuted} />
        <NativeTextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar tienda"
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.searchInput, { color: theme.colors.onSurface }]}
          selectionColor={theme.colors.accent}
          returnKeyType="search"
        />
        {search.trim() ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Limpiar" onPress={() => setSearch('')} hitSlop={8}>
            <Icon source="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <LoadingOrError isLoading={isLoading} error={error} />

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <AnimatedEntrance delay={60 + index * 35} distance={12}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/stores/${item.id}`)}
                style={({ pressed }) => [
                  styles.storeCard,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft },
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={[styles.storeIcon, { backgroundColor: theme.colors.softBlue }]}>
                  <Icon source="store-outline" size={22} color={theme.colors.primary} />
                </View>
                <View style={styles.storeInfo}>
                  <Text style={[styles.storeName, { color: theme.colors.titleOnSoft }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.address ? (
                    <Text style={[styles.storeMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                      {item.address}
                    </Text>
                  ) : null}
                  {item.phone ? (
                    <Text style={[styles.storeMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                      {item.phone}
                    </Text>
                  ) : null}
                </View>
                <Icon source="chevron-right" size={22} color={theme.colors.outline} />
              </Pressable>
          </AnimatedEntrance>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon source="store-outline" size={40} color={theme.colors.borderSoft} />
            <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
              {search.trim() ? 'No hay tiendas que coincidan.' : 'Todavía no hay tiendas. Agregá una nueva.'}
            </Text>
          </View>
        }
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  newButton: { margin: 0, borderRadius: 13 },
  searchBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontSize: 15, lineHeight: 20 },
  listContent: { paddingTop: 4, paddingBottom: 12, gap: 12 },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  cardPressed: { opacity: 0.85 },
  storeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeInfo: { flex: 1, gap: 2 },
  storeName: { fontSize: 15, lineHeight: 20, fontFamily: FONT_SANS_EXTRABOLD },
  storeMeta: { fontSize: 13, lineHeight: 17 },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, textAlign: 'center', maxWidth: 260 },
});
