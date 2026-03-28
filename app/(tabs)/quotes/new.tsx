import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast, useToastMessageEffect } from '@/components/AppToastProvider';
import { useLinkAppointmentToQuote } from '@/features/appointments/hooks';
import { QuoteForm } from '@/features/quotes/QuoteForm';
import { useSaveQuote } from '@/features/quotes/hooks';
import { toUserErrorMessage } from '@/lib/errors';
import { formatDateAr, formatTimeShort } from '@/lib/format';

const getSingleParam = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] ?? '' : value ?? '');

export default function NewQuotePage() {
  const params = useLocalSearchParams<{
    appointmentId?: string | string[];
    scheduledFor?: string | string[];
    startsAt?: string | string[];
    title?: string | string[];
    notes?: string | string[];
  }>();
  const save = useSaveQuote();
  const linkAppointment = useLinkAppointmentToQuote();
  const [message, setMessage] = useState<string | null>(null);
  const toast = useAppToast();
  useToastMessageEffect(message, () => setMessage(null));

  const appointmentId = getSingleParam(params.appointmentId).trim();
  const scheduledFor = getSingleParam(params.scheduledFor).trim();
  const startsAt = getSingleParam(params.startsAt).trim();
  const appointmentTitle = getSingleParam(params.title).trim();
  const appointmentNotes = getSingleParam(params.notes).trim();
  const hasLinkedAppointment = Boolean(appointmentId);

  return (
    <AppScreen title="Nuevo trabajo">
      {hasLinkedAppointment ? (
        <Card mode="contained" style={styles.infoCard}>
          <Card.Content style={styles.infoCardContent}>
            <Text style={styles.infoTitle}>Turno seleccionado</Text>
            <Text style={styles.infoText}>
              {formatDateAr(scheduledFor)}
              {startsAt ? ` - ${formatTimeShort(startsAt)}` : ''}
            </Text>
            <Text style={styles.infoHelper}>El turno se vincula al trabajo cuando guardas el formulario.</Text>
          </Card.Content>
        </Card>
      ) : null}

      <Card mode="outlined" style={styles.formCard}>
        <Card.Content style={styles.formCardContent}>
          <QuoteForm
            defaultValues={{
              title: appointmentTitle,
              notes: appointmentNotes,
            }}
            onSubmit={async (values) => {
              try {
                const quote = await save.mutateAsync({
                  title: values.title,
                  client_name: values.client_name,
                  client_phone: values.client_phone?.trim() ? values.client_phone.trim() : null,
                  notes: values.notes?.trim() ? values.notes.trim() : null,
                  status: 'pending',
                });

                if (!hasLinkedAppointment) {
                  toast.success('Trabajo creado.');
                  router.replace(`/quotes/${quote.id}`);
                  return;
                }

                try {
                  await linkAppointment.mutateAsync({
                    appointmentId,
                    quoteId: quote.id,
                    title: values.title.trim(),
                    notes: values.notes?.trim() ? values.notes.trim() : null,
                  });
                  toast.success('Trabajo creado y vinculado.');
                  router.replace(`/quotes/${quote.id}`);
                } catch (linkError) {
                  toast.error(toUserErrorMessage(linkError, 'El trabajo se creo, pero no se pudo vincular al turno.'));
                  router.replace({
                    pathname: '/quotes/[id]',
                    params: {
                      id: quote.id,
                      linkWarning: '1',
                    },
                  });
                }
              } catch (error) {
                setMessage(toUserErrorMessage(error, 'No se pudo guardar el trabajo.'));
              }
            }}
          />
        </Card.Content>
      </Card>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  infoCardContent: {
    gap: 4,
    paddingVertical: 10,
  },
  infoTitle: {
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoHelper: {
    fontSize: 12,
    lineHeight: 18,
    color: '#5F6A76',
  },
  formCard: {
    borderRadius: 12,
  },
  formCardContent: {
    gap: 14,
    paddingVertical: 8,
  },
});
