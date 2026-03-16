import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Searchbar, Text } from 'react-native-paper';

import type { Store } from '@/types/db';
import { useAppTheme } from '@/theme';

import { AppDialog } from './AppDialog';

const PAGE_SIZE = 8;

interface Props {
  visible: boolean;
  stores: Store[];
  selectedStoreId?: string | null;
  onSelect: (storeId: string | null) => void;
  onDismiss: () => void;
  title?: string;
  allowNoStore?: boolean;
}

export const StoreSelectorDialog = ({
  visible,
  stores,
  selectedStoreId = null,
  onSelect,
  onDismiss,
  title = 'Seleccionar tienda',
  allowNoStore = true,
}: Props) => {
  const theme = useAppTheme();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!visible) return;
    setSearch('');
    setPage(1);
  }, [visible]);

  const filteredStores = useMemo(() => {
    const query = search.trim().toLowerCase();
    const sortedStores = stores.slice().sort((a, b) => a.name.localeCompare(b.name));

    if (!query) return sortedStores;

    return sortedStores.filter(
      (store) =>
        store.name.toLowerCase().includes(query) ||
        (store.address ?? '').toLowerCase().includes(query) ||
        (store.phone ?? '').toLowerCase().includes(query) ||
        (store.description ?? '').toLowerCase().includes(query),
    );
  }, [search, stores]);

  const totalPages = Math.max(1, Math.ceil(filteredStores.length / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredStores.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredStores, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleSelect = (storeId: string | null) => {
    onSelect(storeId);
    onDismiss();
  };

  return (
    <Portal>
      <AppDialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <Searchbar
            placeholder="Buscar por nombre, direccion o telefono"
            value={search}
            onChangeText={setSearch}
            style={[
              styles.searchbar,
              {
                backgroundColor: theme.dark ? '#2B3138' : theme.colors.surface,
                borderColor: theme.colors.borderSoft,
              },
            ]}
            inputStyle={styles.searchInput}
          />

          {allowNoStore ? (
            <Button
              mode={selectedStoreId ? 'outlined' : 'contained-tonal'}
              onPress={() => handleSelect(null)}
              style={styles.noneButton}
              buttonColor={selectedStoreId ? undefined : theme.colors.softYellow}
              textColor={selectedStoreId ? undefined : theme.colors.titleOnSoft}
            >
              Sin tienda
            </Button>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
            <View style={[styles.table, { borderColor: theme.colors.borderSoft }]}>
              <View style={[styles.tableHeader, { backgroundColor: theme.colors.softYellow }]}>
                <Text style={[styles.headerCell, styles.nameColumn, { color: theme.colors.titleOnSoft }]}>Tienda</Text>
                <Text style={[styles.headerCell, styles.addressColumn, { color: theme.colors.titleOnSoft }]}>Direccion</Text>
                <Text style={[styles.headerCell, styles.phoneColumn, { color: theme.colors.titleOnSoft }]}>Telefono</Text>
              </View>

              {pageRows.length > 0 ? (
                pageRows.map((store, index) => {
                  const selected = store.id === selectedStoreId;

                  return (
                    <Pressable
                      key={store.id}
                      onPress={() => handleSelect(store.id)}
                      style={({ pressed }) => [
                        styles.tableRow,
                        { borderColor: theme.colors.borderSoft },
                        index % 2 === 0 ? { backgroundColor: theme.colors.surface } : { backgroundColor: theme.colors.surfaceSoft },
                        selected && { backgroundColor: theme.colors.softYellowStrong },
                        pressed && { opacity: 0.82 },
                      ]}
                    >
                      <Text style={[styles.rowCell, styles.nameColumn, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {store.name}
                      </Text>
                      <Text style={[styles.rowCell, styles.addressColumn, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {store.address?.trim() || '-'}
                      </Text>
                      <Text style={[styles.rowCell, styles.phoneColumn, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {store.phone?.trim() || '-'}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={{ color: theme.colors.textMuted }}>No hay tiendas que coincidan con la busqueda.</Text>
                </View>
              )}
            </View>
          </ScrollView>

          {filteredStores.length > PAGE_SIZE ? (
            <View style={styles.paginationRow}>
              <Button mode="outlined" compact disabled={page <= 1} onPress={() => setPage((current) => Math.max(1, current - 1))}>
                Anterior
              </Button>
              <Text style={{ color: theme.colors.textMuted }}>
                Pagina {page} de {totalPages}
              </Text>
              <Button mode="outlined" compact disabled={page >= totalPages} onPress={() => setPage((current) => Math.min(totalPages, current + 1))}>
                Siguiente
              </Button>
            </View>
          ) : null}
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cerrar</Button>
        </Dialog.Actions>
      </AppDialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  dialog: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  content: {
    gap: 10,
  },
  searchbar: {
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    paddingLeft: 6,
    paddingRight: 10,
  },
  noneButton: {
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  tableScroll: {
    paddingBottom: 2,
  },
  table: {
    minWidth: 720,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  headerCell: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderTopWidth: 1,
  },
  rowCell: {
    fontSize: 13,
    lineHeight: 18,
  },
  nameColumn: {
    width: 240,
    paddingRight: 8,
  },
  addressColumn: {
    width: 320,
    paddingRight: 8,
  },
  phoneColumn: {
    width: 150,
  },
  emptyState: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
