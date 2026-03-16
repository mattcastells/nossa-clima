import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, Text, TextInput } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { AppScreen } from '@/components/AppScreen';
import { useToastMessageEffect } from '@/components/AppToastProvider';
import { LoadingOrError } from '@/components/LoadingOrError';
import {
  useCreateServiceCategory,
  useDeleteServiceCategory,
  useRenameServiceCategory,
  useServiceCategories,
  useServices,
} from '@/features/services/hooks';
import { toUserErrorMessage } from '@/lib/errors';

interface CategoryListItem {
  name: string;
  usageCount: number;
  isVirtual?: boolean;
}

const normalizeCategoryName = (value: string): string => value.trim().replace(/\s+/g, ' ');

export default function ServiceCategoriesPage() {
  const { data: categoriesData, isLoading: categoriesLoading, error: categoriesError } = useServiceCategories();
  const { data: servicesData, isLoading: servicesLoading, error: servicesError } = useServices();
  const createCategory = useCreateServiceCategory();
  const renameCategory = useRenameServiceCategory();
  const deleteCategory = useDeleteServiceCategory();

  const [newCategoryName, setNewCategoryName] = useState('');
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CategoryListItem | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useToastMessageEffect(message, () => setMessage(null));

  const usageByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    for (const service of servicesData ?? []) {
      const normalized = normalizeCategoryName(service.category ?? '');
      if (!normalized) continue;
      const key = normalized.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [servicesData]);

  const uncategorizedCount = useMemo(
    () =>
      (servicesData ?? []).filter((service) => {
        const normalized = normalizeCategoryName(service.category ?? '');
        return normalized.length === 0;
      }).length,
    [servicesData],
  );

  const categories = useMemo<CategoryListItem[]>(() => {
    const baseCategories: CategoryListItem[] = (categoriesData ?? []).map((name) => ({
      name,
      usageCount: usageByCategory.get(name.toLowerCase()) ?? 0,
    }));

    if (uncategorizedCount > 0) {
      baseCategories.push({
        name: 'Sin categorias',
        usageCount: uncategorizedCount,
        isVirtual: true,
      });
    }

    return baseCategories;
  }, [categoriesData, usageByCategory, uncategorizedCount]);

  const busy = createCategory.isPending || renameCategory.isPending || deleteCategory.isPending;

  const submitCreate = async () => {
    const normalized = normalizeCategoryName(newCategoryName);
    if (!normalized) {
      setMessage('Escribi un nombre de categoria.');
      return;
    }

    try {
      await createCategory.mutateAsync(normalized);
      setNewCategoryName('');
      setMessage('Categoria creada.');
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo crear la categoria.'));
    }
  };

  const submitRename = async () => {
    const currentName = renameTarget;
    if (!currentName) return;

    const normalized = normalizeCategoryName(renameValue);
    if (!normalized) {
      setMessage('Escribi el nuevo nombre de categoria.');
      return;
    }

    try {
      await renameCategory.mutateAsync({ currentName, nextName: normalized });
      setRenameTarget(null);
      setRenameValue('');
      setMessage('Categoria actualizada.');
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo actualizar la categoria.'));
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteCategory.mutateAsync(deleteTarget.name);
      setDeleteTarget(null);
      setMessage('Categoria eliminada.');
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo eliminar la categoria.'));
    }
  };

  return (
    <AppScreen title="Categorias de servicios">
      <Card mode="outlined" style={styles.formCard}>
        <Card.Content style={styles.formCardContent}>
          <Text variant="titleSmall">Nueva categoria</Text>
          <TextInput
            mode="outlined"
            label="Nombre"
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            outlineStyle={styles.inputOutline}
          />
          <Button mode="contained" onPress={submitCreate} loading={createCategory.isPending} disabled={busy} style={styles.primaryButton}>
            Agregar categoria
          </Button>
        </Card.Content>
      </Card>

      <LoadingOrError isLoading={categoriesLoading || servicesLoading} error={categoriesError ?? servicesError} />

      <FlatList
        data={categories}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card mode="outlined" style={styles.categoryCard}>
            <Card.Content style={styles.categoryCardContent}>
              <View style={styles.categoryInfo}>
                <Text variant="titleMedium">{item.name}</Text>
                <Text style={styles.helperText}>
                  {item.isVirtual
                    ? `${item.usageCount} servicio(s) sin categoria`
                    : item.usageCount > 0
                      ? `${item.usageCount} servicio(s) asociado(s)`
                      : 'Sin servicios asociados'}
                </Text>
              </View>
              {!item.isVirtual ? (
                <View style={styles.actionsRow}>
                  <Button
                    mode="text"
                    compact
                    onPress={() => {
                      setRenameTarget(item.name);
                      setRenameValue(item.name);
                    }}
                    disabled={busy}
                  >
                    Editar
                  </Button>
                  <Button mode="text" compact textColor="#B3261E" onPress={() => setDeleteTarget(item)} disabled={busy}>
                    Borrar
                  </Button>
                </View>
              ) : (
                <Text style={styles.virtualCategoryHint}>Aparece automaticamente mientras existan servicios sin categoria.</Text>
              )}
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text>No hay categorias cargadas.</Text>}
      />

      <Portal>
        <AppDialog visible={Boolean(renameTarget)} onDismiss={() => !busy && setRenameTarget(null)}>
          <Dialog.Title>Editar categoria</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <TextInput mode="outlined" label="Nuevo nombre" value={renameValue} onChangeText={setRenameValue} outlineStyle={styles.inputOutline} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              disabled={busy}
              onPress={() => {
                setRenameTarget(null);
                setRenameValue('');
              }}
            >
              Cancelar
            </Button>
            <Button onPress={submitRename} loading={renameCategory.isPending} disabled={busy}>
              Guardar
            </Button>
          </Dialog.Actions>
        </AppDialog>

        <AppDialog visible={Boolean(deleteTarget)} onDismiss={() => !busy && setDeleteTarget(null)}>
          <Dialog.Title>Borrar categoria</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            <Text>Se va a eliminar la categoria {deleteTarget?.name}.</Text>
            {deleteTarget && deleteTarget.usageCount > 0 ? (
              <Text>Ademas, se quitara esa categoria de {deleteTarget.usageCount} servicio(s).</Text>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button disabled={busy} onPress={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button textColor="#B3261E" onPress={submitDelete} loading={deleteCategory.isPending} disabled={busy}>
              Borrar
            </Button>
          </Dialog.Actions>
        </AppDialog>
      </Portal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderRadius: 12,
  },
  formCardContent: {
    gap: 10,
    paddingVertical: 8,
  },
  inputOutline: {
    borderRadius: 10,
  },
  primaryButton: {
    borderRadius: 10,
  },
  listContent: {
    paddingBottom: 12,
    gap: 10,
  },
  categoryCard: {
    borderRadius: 12,
  },
  categoryCardContent: {
    gap: 10,
  },
  categoryInfo: {
    gap: 2,
  },
  helperText: {
    color: '#5f6368',
  },
  virtualCategoryHint: {
    color: '#5f6368',
    fontSize: 12,
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  dialogContent: {
    gap: 10,
  },
});
