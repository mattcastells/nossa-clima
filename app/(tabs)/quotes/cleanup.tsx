import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, SegmentedButtons, Text, TextInput } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useToastMessageEffect } from '@/components/AppToastProvider';
import { useDeleteAllQuotes, useDeleteOldQuotes } from '@/features/quotes/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatDateAr } from '@/lib/format';

type CleanupMode = '90' | '180' | 'all';

const OPTIONS = [
  { value: '90', label: '90 dias' },
  { value: '180', label: '180 dias' },
  { value: 'all', label: 'Todos' },
];

const getCutoffDateLabel = (days: number): string => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  return formatDateAr(cutoffDate.toISOString());
};

export default function QuotesCleanupPage() {
  const deleteOldQuotes = useDeleteOldQuotes();
  const deleteAllQuotes = useDeleteAllQuotes();
  const [mode, setMode] = useState<CleanupMode>('180');
  const [confirmText, setConfirmText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  useToastMessageEffect(message, () => setMessage(null));

  const isBusy = deleteOldQuotes.isPending || deleteAllQuotes.isPending;
  const canRun = confirmText.trim().toUpperCase() === 'ELIMINAR';

  const summary = useMemo(() => {
    if (mode === 'all') {
      return 'Se eliminaran todos los trabajos existentes.';
    }
    const days = Number(mode);
    return `Se eliminaran trabajos anteriores al ${getCutoffDateLabel(days)}.`;
  }, [mode]);

  const runCleanup = async () => {
    try {
      if (mode === 'all') {
        const result = await deleteAllQuotes.mutateAsync();
        setMessage(result.deletedCount > 0 ? `Se eliminaron ${result.deletedCount} trabajos.` : 'No habia trabajos para eliminar.');
        return;
      }

      const result = await deleteOldQuotes.mutateAsync(Number(mode));
      setMessage(
        result.deletedCount > 0
          ? `Se eliminaron ${result.deletedCount} trabajos anteriores al ${formatDateAr(result.cutoffIso)}.`
          : `No habia trabajos anteriores al ${formatDateAr(result.cutoffIso)}.`,
      );
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo ejecutar la limpieza.'));
    }
  };

  return (
    <AppScreen title="Limpiar trabajos antiguos">
      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.content}>
          <Text>Esta accion elimina trabajos de forma irreversible.</Text>

          <SegmentedButtons value={mode} onValueChange={(value) => setMode(value as CleanupMode)} buttons={OPTIONS} />

          <Text>{summary}</Text>

          <TextInput
            mode="outlined"
            label='Escribe "ELIMINAR" para confirmar'
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
          />

          <View style={styles.actions}>
            <Button mode="outlined" onPress={() => setConfirmText('')} disabled={isBusy}>
              Limpiar confirmacion
            </Button>
            <Button mode="contained" onPress={runCleanup} loading={isBusy} disabled={isBusy || !canRun}>
              Ejecutar limpieza
            </Button>
          </View>
        </Card.Content>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
  },
  content: {
    gap: 14,
    paddingVertical: 10,
  },
  actions: {
    gap: 10,
  },
});
