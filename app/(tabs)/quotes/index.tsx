import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Dialog, Portal, SegmentedButtons, Snackbar, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { LoadingOrError } from '@/components/LoadingOrError';
import { useDeleteOldQuotes, useQuotes } from '@/features/quotes/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatCurrencyArs, formatDateAr } from '@/lib/format';

type CleanupStep = 'select' | 'confirm';

const CLEANUP_OPTIONS = [
  { value: '90', label: '90 dias' },
  { value: '180', label: '180 dias' },
  { value: '365', label: '365 dias' },
];

export default function QuotesScreen() {
  const { data, isLoading, error } = useQuotes();
  const deleteOldQuotes = useDeleteOldQuotes();

  const [cleanupVisible, setCleanupVisible] = useState(false);
  const [cleanupStep, setCleanupStep] = useState<CleanupStep>('select');
  const [olderThanDays, setOlderThanDays] = useState<string>('180');
  const [confirmText, setConfirmText] = useState('');
  const [snack, setSnack] = useState<string | null>(null);

  const cutoffLabel = useMemo(() => {
    const days = Number(olderThanDays);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (Number.isFinite(days) ? days : 180));
    return formatDateAr(cutoffDate.toISOString());
  }, [olderThanDays]);

  const resetCleanupDialog = () => {
    setCleanupVisible(false);
    setCleanupStep('select');
    setConfirmText('');
  };

  const handleRunCleanup = async () => {
    try {
      const result = await deleteOldQuotes.mutateAsync(Number(olderThanDays));
      if (result.deletedCount === 0) {
        setSnack(`No habia presupuestos anteriores al ${cutoffLabel}.`);
      } else {
        setSnack(`Se eliminaron ${result.deletedCount} presupuestos anteriores al ${cutoffLabel}.`);
      }
      resetCleanupDialog();
    } catch (mutationError) {
      setSnack(toUserErrorMessage(mutationError, 'No se pudieron eliminar los presupuestos antiguos.'));
    }
  };

  return (
    <AppScreen title="Presupuestos">
      <View style={styles.topActions}>
        <Link href="/quotes/new" asChild>
          <Button mode="contained">Nuevo presupuesto</Button>
        </Link>
        <Button mode="outlined" icon="delete-sweep-outline" onPress={() => setCleanupVisible(true)}>
          Limpiar antiguos
        </Button>
      </View>

      <LoadingOrError isLoading={isLoading} error={error} />

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Link href={`/quotes/${item.id}`} asChild>
            <Card mode="outlined" style={styles.quoteCard}>
              <Card.Content style={styles.quoteContent}>
                <Text variant="titleMedium">{item.client_name}</Text>
                <Text>{item.title}</Text>
                <Text>{formatCurrencyArs(item.total)}</Text>
                <Text>{formatDateAr(item.created_at)}</Text>
              </Card.Content>
            </Card>
          </Link>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text>No hay presupuestos cargados. Crea uno nuevo para comenzar.</Text>
          </View>
        }
      />

      <Portal>
        <Dialog visible={cleanupVisible} onDismiss={resetCleanupDialog}>
          <Dialog.Title>Limpiar presupuestos antiguos</Dialog.Title>
          <Dialog.Content style={styles.dialogContent}>
            {cleanupStep === 'select' ? (
              <>
                <Text>Selecciona la antiguedad a eliminar.</Text>
                <SegmentedButtons value={olderThanDays} onValueChange={setOlderThanDays} buttons={CLEANUP_OPTIONS} />
                <Text>Se eliminaran presupuestos anteriores al {cutoffLabel}.</Text>
              </>
            ) : (
              <>
                <Text>Confirmacion final: esta accion es irreversible.</Text>
                <TextInput
                  mode="outlined"
                  label='Escribe "ELIMINAR"'
                  autoCapitalize="characters"
                  value={confirmText}
                  onChangeText={setConfirmText}
                />
              </>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            {cleanupStep === 'select' ? (
              <>
                <Button onPress={resetCleanupDialog}>Cancelar</Button>
                <Button onPress={() => setCleanupStep('confirm')}>Continuar</Button>
              </>
            ) : (
              <>
                <Button onPress={() => setCleanupStep('select')}>Volver</Button>
                <Button
                  onPress={handleRunCleanup}
                  loading={deleteOldQuotes.isPending}
                  disabled={deleteOldQuotes.isPending || confirmText.trim().toUpperCase() !== 'ELIMINAR'}
                  textColor="#B00020"
                >
                  Eliminar
                </Button>
              </>
            )}
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={Boolean(snack)} onDismiss={() => setSnack(null)} duration={2800}>
        {snack}
      </Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  topActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  quoteCard: {
    marginBottom: 10,
  },
  quoteContent: {
    gap: 6,
  },
  emptyState: {
    paddingVertical: 8,
  },
  dialogContent: {
    gap: 12,
  },
});
