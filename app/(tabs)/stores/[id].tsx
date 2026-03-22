import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, IconButton, Portal, Searchbar, Text } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { CatalogAuditCard } from '@/components/CatalogAuditCard';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useLatestMeasurePrices, useLatestPrices } from '@/features/prices/hooks';
import { useProfileDirectory } from '@/features/profiles/hooks';
import { StoreForm } from '@/features/stores/StoreForm';
import { useArchiveStore, useSaveStore, useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs, formatDateAr, formatDateTimeAr } from '@/lib/format';
import { useAppTheme } from '@/theme';

const formatAuditActor = (userId: string | null | undefined, namesById: Map<string, string>): string => {
  if (!userId) return 'Usuario eliminado';
  return namesById.get(userId) ?? `Usuario ${userId.slice(0, 8)}`;
};

const PRICE_ROWS_PAGE_SIZE = 20;

type StorePriceRow =
  | {
      key: string;
      itemId: string;
      materialName: string;
      detail: string;
      category: string | null;
      priceLabel: string;
      observedAt: string;
    }
  | {
      key: string;
      itemId: string;
      materialName: string;
      detail: string;
      category: string | null;
      priceLabel: string;
      observedAt: string;
    };

export default function StoreDetailPage() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useStores();
  const latestPricesQuery = useLatestPrices();
  const latestMeasurePricesQuery = useLatestMeasurePrices(id ? { storeId: id } : {});
  const save = useSaveStore();
  const archive = useArchiveStore();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [materialsSearch, setMaterialsSearch] = useState('');
  const [materialsPage, setMaterialsPage] = useState(1);
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));
  const store = data?.find((s) => s.id === id);
  const auditUserIds = useMemo(
    () => [store?.user_id, store?.updated_by].filter((value): value is string => Boolean(value)),
    [store?.updated_by, store?.user_id],
  );
  const { data: auditUsers } = useProfileDirectory(auditUserIds);
  const auditNamesById = useMemo(
    () =>
      new Map(
        (auditUsers ?? []).map((entry) => [entry.id, entry.full_name?.trim() ? entry.full_name.trim() : `Usuario ${entry.id.slice(0, 8)}`]),
      ),
    [auditUsers],
  );

  const measureRows = useMemo(
    () => (id ? (latestMeasurePricesQuery.data ?? []).filter((row) => row.store_id === id) : []),
    [id, latestMeasurePricesQuery.data],
  );
  const measuredItemIds = useMemo(() => new Set(measureRows.map((row) => row.item_id)), [measureRows]);
  const directRows = useMemo(
    () => (latestPricesQuery.data ?? []).filter((row) => row.store_id === id && !measuredItemIds.has(row.item_id)),
    [id, latestPricesQuery.data, measuredItemIds],
  );

  const rows = useMemo<StorePriceRow[]>(
    () => [
      ...measureRows.map((row) => ({
        key: `measure-${row.id}`,
        itemId: row.item_id,
        materialName: row.item_name,
        detail: `${row.item_measurement_label} (${row.measurement_unit})`,
        category: row.item_category,
        priceLabel: `${formatCurrencyArs(row.price)} / ${row.measurement_unit}`,
        observedAt: row.observed_at,
      })),
      ...directRows.map((row) => ({
        key: `direct-${row.id}`,
        itemId: row.item_id,
        materialName: row.item_name,
        detail: row.item_unit ?? row.base_price_label ?? 'Directo',
        category: row.item_category ?? null,
        priceLabel: formatCurrencyArs(row.price),
        observedAt: row.observed_at,
      })),
    ],
    [directRows, measureRows],
  );

  const filteredPriceRows = useMemo(() => {
    const normalizedQuery = materialsSearch.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((row) => {
      return (
        row.materialName.toLowerCase().includes(normalizedQuery) ||
        row.detail.toLowerCase().includes(normalizedQuery) ||
        (row.category ?? '').toLowerCase().includes(normalizedQuery)
      );
    });
  }, [materialsSearch, rows]);
  const totalMaterialsPages = Math.max(1, Math.ceil(filteredPriceRows.length / PRICE_ROWS_PAGE_SIZE));
  const paginatedPriceRows = useMemo(() => {
    const startIndex = (materialsPage - 1) * PRICE_ROWS_PAGE_SIZE;
    return filteredPriceRows.slice(startIndex, startIndex + PRICE_ROWS_PAGE_SIZE);
  }, [filteredPriceRows, materialsPage]);

  useEffect(() => {
    setMaterialsPage(1);
  }, [materialsSearch]);

  useEffect(() => {
    if (materialsPage > totalMaterialsPages) {
      setMaterialsPage(totalMaterialsPages);
    }
  }, [materialsPage, totalMaterialsPages]);

  return (
    <AppScreen title="Detalle de tienda">
      <LoadingOrError isLoading={isLoading} error={error} />

      {store && (
        <StoreForm
          defaultValues={{
            name: store.name,
            description: store.description ?? '',
            address: store.address ?? '',
            phone: store.phone ?? '',
            notes: store.notes ?? '',
          }}
          onSubmit={async (values) => {
            try {
              await save.mutateAsync({
                id: store.id,
                name: values.name,
                description: values.description?.trim() ? values.description.trim() : null,
                address: values.address?.trim() ? values.address.trim() : null,
                phone: values.phone?.trim() ? values.phone.trim() : null,
                notes: values.notes?.trim() ? values.notes.trim() : null,
              });
              setMessage('Tienda guardada.');
            } catch (saveError) {
              setMessage(toUserErrorMessage(saveError, 'No se pudo guardar la tienda.'));
            }
          }}
        />
      )}

      {store && (
        <Button mode="contained" buttonColor="#B3261E" textColor="#FFFFFF" onPress={() => setConfirmDelete(true)} disabled={archive.isPending}>
          Archivar tienda
        </Button>
      )}

      <Card mode="outlined" style={[styles.tableCard, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surfaceAlt }]}>
        <Card.Content style={styles.tableContent}>
          <View style={styles.tableHeaderBlock}>
            <Text variant="titleSmall" style={{ color: theme.colors.onSurface }}>
              Materiales y precios en esta tienda
            </Text>
          </View>

          <LoadingOrError
            isLoading={latestPricesQuery.isLoading || latestMeasurePricesQuery.isLoading}
            error={latestPricesQuery.error ?? latestMeasurePricesQuery.error ?? null}
          />

          {!latestPricesQuery.isLoading && !latestMeasurePricesQuery.isLoading && rows.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>No hay materiales asociados con precio en esta tienda.</Text>
            </View>
          ) : null}

          {rows.length > 0 ? (
            <>
              <Searchbar
                placeholder="Buscar material, medida o categoria"
                value={materialsSearch}
                onChangeText={setMaterialsSearch}
                inputStyle={styles.searchbarInput}
                style={[
                  styles.searchbar,
                  {
                    backgroundColor: theme.dark ? '#2B3138' : theme.colors.surface,
                    borderColor: theme.colors.borderSoft,
                  },
                ]}
              />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
                <View style={styles.tableFrame}>
                  <View style={[styles.tableHeader, { backgroundColor: theme.colors.softGreen }]}>
                    <Text style={[styles.headerCell, styles.materialColumn, { color: theme.colors.titleOnSoft }]}>Material</Text>
                    <Text style={[styles.headerCell, styles.detailColumn, { color: theme.colors.titleOnSoft }]}>Detalle</Text>
                    <Text style={[styles.headerCell, styles.categoryColumn, { color: theme.colors.titleOnSoft }]}>Categoria</Text>
                    <Text style={[styles.headerCell, styles.priceColumn, { color: theme.colors.titleOnSoft }]}>Precio</Text>
                    <Text style={[styles.headerCell, styles.dateColumn, { color: theme.colors.titleOnSoft }]}>Fecha</Text>
                  </View>

                  {paginatedPriceRows.length > 0 ? (
                    paginatedPriceRows.map((row, index) => (
                      <Pressable
                        key={row.key}
                        onPress={() => router.push(`/items/${row.itemId}`)}
                        style={({ pressed }) => [
                          styles.tableRow,
                          { borderColor: theme.colors.borderSoft },
                          index % 2 === 0 ? { backgroundColor: theme.colors.surface } : { backgroundColor: theme.colors.surfaceSoft },
                          pressed && { backgroundColor: theme.colors.softGreenStrong },
                        ]}
                      >
                        <Text
                          style={[styles.rowCell, styles.materialColumn, styles.materialValue, { color: theme.colors.onSurface }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {row.materialName}
                        </Text>
                        <Text
                          style={[styles.rowCell, styles.detailColumn, { color: theme.colors.onSurface }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {row.detail}
                        </Text>
                        <Text
                          style={[styles.rowCell, styles.categoryColumn, { color: row.category ? theme.colors.onSurface : theme.colors.textMuted }]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {row.category ?? 'Sin categoria'}
                        </Text>
                        <Text style={[styles.rowCell, styles.priceColumn, styles.priceValue, { color: theme.colors.onSurface }]}>{row.priceLabel}</Text>
                        <Text style={[styles.rowCell, styles.dateColumn, { color: theme.colors.textMuted }]}>{formatDateAr(row.observedAt)}</Text>
                      </Pressable>
                    ))
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>No hay materiales que coincidan con la busqueda.</Text>
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={styles.paginationBar}>
                <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                  {filteredPriceRows.length > 0
                    ? `Mostrando ${(materialsPage - 1) * PRICE_ROWS_PAGE_SIZE + 1}-${Math.min(materialsPage * PRICE_ROWS_PAGE_SIZE, filteredPriceRows.length)} de ${filteredPriceRows.length}`
                    : 'Sin resultados'}
                </Text>
                <View style={styles.paginationActions}>
                  <IconButton
                    icon="arrow-left"
                    mode="outlined"
                    size={18}
                    accessibilityLabel="Pagina anterior de materiales"
                    onPress={() => setMaterialsPage((current) => Math.max(1, current - 1))}
                    disabled={materialsPage === 1}
                    style={styles.paginationIcon}
                  />
                  <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
                    Pagina {materialsPage} de {totalMaterialsPages}
                  </Text>
                  <IconButton
                    icon="arrow-right"
                    mode="outlined"
                    size={18}
                    accessibilityLabel="Pagina siguiente de materiales"
                    onPress={() => setMaterialsPage((current) => Math.min(totalMaterialsPages, current + 1))}
                    disabled={materialsPage === totalMaterialsPages}
                    style={styles.paginationIcon}
                  />
                </View>
              </View>
            </>
          ) : null}
        </Card.Content>
      </Card>

      {store ? (
        <CatalogAuditCard
          createdBy={formatAuditActor(store.user_id, auditNamesById)}
          createdAt={formatDateTimeAr(store.created_at)}
          updatedBy={formatAuditActor(store.updated_by ?? store.user_id, auditNamesById)}
          updatedAt={formatDateTimeAr(store.updated_at)}
        />
      ) : null}

      <Portal>
        <AppDialog visible={confirmDelete} onDismiss={() => !archive.isPending && setConfirmDelete(false)}>
          <Dialog.Title>Archivar tienda</Dialog.Title>
          <Dialog.Content>
            <Text>La tienda deja de aparecer en nuevas selecciones y catalogos activos.</Text>
            <Text>Los trabajos viejos conservan el origen historico que ya quedo guardado.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={archive.isPending} onPress={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              loading={archive.isPending}
              textColor="#B3261E"
              onPress={async () => {
                if (!store) return;
                try {
                  await archive.mutateAsync(store.id);
                  setConfirmDelete(false);
                  toast.success('Tienda archivada.');
                  router.back();
                } catch (archiveError) {
                  setConfirmDelete(false);
                  setMessage(toUserErrorMessage(archiveError, 'No se pudo archivar la tienda.'));
                }
              }}
            >
              Archivar
            </Button>
          </Dialog.Actions>
        </AppDialog>
      </Portal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  tableCard: {
    borderRadius: 12,
    borderWidth: 1,
  },
  tableContent: {
    gap: 10,
    paddingVertical: 8,
  },
  tableHeaderBlock: {
    gap: 2,
  },
  searchbar: {
    borderRadius: 10,
    borderWidth: 1,
  },
  searchbarInput: {
    paddingLeft: 4,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  emptyState: {
    paddingVertical: 8,
  },
  tableScrollContent: {
    paddingBottom: 2,
  },
  tableFrame: {
    minWidth: 660,
    gap: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  headerCell: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderWidth: 1,
  },
  rowCell: {
    fontSize: 13,
    lineHeight: 18,
  },
  materialColumn: {
    width: 170,
    paddingRight: 8,
  },
  detailColumn: {
    width: 130,
    paddingRight: 8,
  },
  categoryColumn: {
    width: 130,
    paddingRight: 8,
  },
  priceColumn: {
    width: 120,
    paddingRight: 8,
  },
  dateColumn: {
    width: 90,
  },
  materialValue: {
    fontWeight: '600',
  },
  priceValue: {
    fontWeight: '600',
  },
  paginationBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  paginationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paginationIcon: {
    margin: 0,
  },
});
