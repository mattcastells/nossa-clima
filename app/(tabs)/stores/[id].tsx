import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, Text } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { CatalogAuditCard } from '@/components/CatalogAuditCard';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useProfileDirectory } from '@/features/profiles/hooks';
import { StoreForm } from '@/features/stores/StoreForm';
import { useArchiveStore, useSaveStore, useStoreLatestPrices, useStores } from '@/features/stores/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs, formatDateAr, formatDateTimeAr } from '@/lib/format';
import { BRAND_GREEN, BRAND_GREEN_SOFT } from '@/theme';

const formatAuditActor = (userId: string | null | undefined, namesById: Map<string, string>): string => {
  if (!userId) return 'Usuario eliminado';
  return namesById.get(userId) ?? `Usuario ${userId.slice(0, 8)}`;
};

export default function StoreDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = useStores();
  const { data: priceRows, isLoading: pricesLoading, error: pricesError } = useStoreLatestPrices(id ?? '');
  const save = useSaveStore();
  const archive = useArchiveStore();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

      {store ? (
        <CatalogAuditCard
          createdBy={formatAuditActor(store.user_id, auditNamesById)}
          createdAt={formatDateTimeAr(store.created_at)}
          updatedBy={formatAuditActor(store.updated_by ?? store.user_id, auditNamesById)}
          updatedAt={formatDateTimeAr(store.updated_at)}
        />
      ) : null}

      {store && (
        <Button mode="outlined" textColor="#B3261E" onPress={() => setConfirmDelete(true)} disabled={archive.isPending}>
          Archivar tienda
        </Button>
      )}

      <Card mode="outlined" style={styles.tableCard}>
        <Card.Content style={styles.tableContent}>
          <View style={styles.tableHeaderBlock}>
            <Text variant="titleSmall">Materiales y precios en esta tienda</Text>
          </View>
          <LoadingOrError isLoading={pricesLoading} error={pricesError ? new Error(pricesError.message) : null} />
          {!pricesLoading && (priceRows?.length ?? 0) === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.helperText}>No hay materiales asociados con precio en esta tienda.</Text>
            </View>
          )}
          {(priceRows?.length ?? 0) > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScrollContent}>
              <View style={styles.tableFrame}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.headerCell, styles.materialColumn]}>Material</Text>
                  <Text style={[styles.headerCell, styles.priceColumn]}>Precio</Text>
                  <Text style={[styles.headerCell, styles.dateColumn]}>Fecha</Text>
                </View>

                {priceRows?.map((row, index) => (
                  <Pressable
                    key={row.id}
                    onPress={() => router.push(`/items/${row.item_id}`)}
                    style={({ pressed }) => [
                      styles.tableRow,
                      index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
                      pressed && styles.tableRowPressed,
                    ]}
                  >
                    <Text
                      style={[styles.rowCell, styles.materialColumn, styles.materialValue]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {row.item_name}
                    </Text>
                    <Text style={[styles.rowCell, styles.priceColumn, styles.priceValue]}>{formatCurrencyArs(row.price)}</Text>
                    <Text style={[styles.rowCell, styles.dateColumn]}>{formatDateAr(row.observed_at)}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}
        </Card.Content>
      </Card>

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
  },
  tableContent: {
    gap: 10,
    paddingVertical: 8,
  },
  tableHeaderBlock: {
    gap: 2,
  },
  helperText: {
    color: '#5f6368',
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
    minWidth: 322,
    gap: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_GREEN_SOFT,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  headerCell: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: BRAND_GREEN,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DCE4EC',
  },
  tableRowEven: {
    backgroundColor: '#FFFFFF',
  },
  tableRowOdd: {
    backgroundColor: '#F8FBFF',
  },
  tableRowPressed: {
    backgroundColor: '#EEF5EB',
  },
  rowCell: {
    fontSize: 13,
    lineHeight: 18,
  },
  materialColumn: {
    width: 138,
    paddingRight: 3,
  },
  priceColumn: {
    width: 86,
    paddingRight: 3,
  },
  dateColumn: {
    width: 76,
  },
  materialValue: {
    fontWeight: '500',
  },
  priceValue: {
    fontWeight: '600',
  },
});
