import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Card, Snackbar } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { QuoteForm } from '@/features/quotes/QuoteForm';
import { useSaveQuote } from '@/features/quotes/hooks';
import { toUserErrorMessage } from '@/lib/errors';

export default function NewQuotePage() {
  const save = useSaveQuote();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <AppScreen title="Nuevo presupuesto">
      <Card mode="outlined" style={styles.formCard}>
        <Card.Content style={styles.formCardContent}>
          <QuoteForm
            onSubmit={async (values) => {
              try {
                const quote = await save.mutateAsync({
                  title: values.title,
                  client_name: values.client_name,
                  client_phone: values.client_phone?.trim() ? values.client_phone.trim() : null,
                  notes: values.notes?.trim() ? values.notes.trim() : null,
                  status: 'draft',
                });
                router.replace(`/quotes/${quote.id}`);
              } catch (error) {
                setMessage(toUserErrorMessage(error, 'No se pudo guardar el presupuesto.'));
              }
            }}
          />
        </Card.Content>
      </Card>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    borderRadius: 12,
  },
  formCardContent: {
    gap: 14,
    paddingVertical: 8,
  },
});
