import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Searchbar, Text } from 'react-native-paper';

import { SelectionPanel, SelectionRow } from '@/components/SelectionPanel';
import { FONT_SANS_BOLD, useAppTheme } from '@/theme';
import type { Store } from '@/types/db';

/**
 * Elegir la tienda antes que el material.
 *
 * El flujo siempre fue "primero el local, después lo que ese local tiene", pero
 * no se notaba: la lista de tiendas seguía ocupando media pantalla después de
 * elegir, y todas las tiendas se veían iguales aunque varias no tuvieran ningún
 * precio cargado. Acá se resuelven las dos cosas:
 *
 *   - elegida la tienda, el selector se pliega a una línea con "Cambiar", y la
 *     pantalla queda para los materiales;
 *   - cada tienda muestra cuántos materiales tiene con precio, y las que más
 *     tienen van primero. Una tienda sin precios se ve, pero avisa: elegirla y
 *     encontrar la lista vacía era el camino fácil hasta ahora.
 */

interface Props {
  stores: Store[];
  selectedStoreId: string | null;
  onSelect: (storeId: string | null) => void;
  /** Cuántos materiales con precio tiene cada tienda. */
  materialCountByStoreId: Map<string, number>;
  disabled?: boolean;
}

const materialsLabel = (count: number): string => {
  if (count === 0) return 'Sin precios cargados';
  return count === 1 ? '1 material' : `${count} materiales`;
};

export function StorePicker({ stores, selectedStoreId, onSelect, materialCountByStoreId, disabled = false }: Props) {
  const theme = useAppTheme();
  const [search, setSearch] = useState('');
  /** Se abre a mano solo cuando ya hay una tienda elegida. */
  const [reopened, setReopened] = useState(false);

  const selectedStore = useMemo(
    () => stores.find((store) => store.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const expanded = selectedStore === null || reopened;

  const orderedStores = useMemo(() => {
    const query = search.trim().toLowerCase();

    return stores
      .filter(
        (store) =>
          !query ||
          store.name.toLowerCase().includes(query) ||
          (store.address ?? '').toLowerCase().includes(query) ||
          (store.description ?? '').toLowerCase().includes(query),
      )
      .slice()
      .sort((a, b) => {
        // Las que tienen materiales primero: son las que sirven para cotizar.
        const countDiff = (materialCountByStoreId.get(b.id) ?? 0) - (materialCountByStoreId.get(a.id) ?? 0);
        return countDiff !== 0 ? countDiff : a.name.localeCompare(b.name);
      });
  }, [materialCountByStoreId, search, stores]);

  if (!expanded && selectedStore) {
    const count = materialCountByStoreId.get(selectedStore.id) ?? 0;

    return (
      <View style={[styles.collapsed, { backgroundColor: theme.colors.softBlue }]}>
        <View style={styles.collapsedText}>
          <Text style={[styles.collapsedTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={1}>
            {selectedStore.name}
          </Text>
          <Text style={[styles.collapsedMeta, { color: theme.colors.titleOnSoft }]} numberOfLines={1}>
            {materialsLabel(count)}
          </Text>
        </View>
        <Button
          compact
          mode="text"
          onPress={() => {
            setReopened(true);
            setSearch('');
          }}
          disabled={disabled}
          style={styles.changeButton}
        >
          Cambiar
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.expanded}>
      <Searchbar
        placeholder="Buscar tienda"
        value={search}
        onChangeText={setSearch}
        style={[
          styles.searchbar,
          {
            backgroundColor: theme.dark ? theme.colors.background : theme.colors.surface,
            borderColor: theme.colors.borderSoft,
          },
        ]}
        inputStyle={styles.searchbarInput}
      />

      <SelectionPanel
        data={orderedStores}
        keyExtractor={(store) => store.id}
        emptyText="No se encontraron tiendas."
        maxHeight={260}
        renderItem={(store) => (
          <SelectionRow
            title={store.name}
            meta={store.address}
            trailing={materialsLabel(materialCountByStoreId.get(store.id) ?? 0)}
            selected={store.id === selectedStoreId}
            tone="blue"
            disabled={disabled}
            onPress={() => {
              onSelect(store.id);
              setReopened(false);
              setSearch('');
            }}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  expanded: {
    gap: 10,
  },
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    paddingVertical: 6,
    gap: 8,
    minHeight: 48,
  },
  collapsedText: {
    flex: 1,
    gap: 2,
  },
  collapsedTitle: {
    fontSize: 14,
    fontFamily: FONT_SANS_BOLD,
  },
  collapsedMeta: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.85,
  },
  changeButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  searchbar: {
    borderRadius: 12,
    borderWidth: 1,
  },
  searchbarInput: {
    paddingLeft: 4,
  },
});
