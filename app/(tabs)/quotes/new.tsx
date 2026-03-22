import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { useAppToast } from '@/components/AppToastProvider';
import { useLinkAppointmentToQuote } from '@/features/appointments/hooks';
import { useSaveQuote } from '@/features/quotes/hooks';
import { toUserErrorMessage } from '@/lib/errors';

const getSingleParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? '') : (value ?? '');

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
  const toast = useAppToast();
  const didCreate = useRef(false);

  const appointmentId = getSingleParam(params.appointmentId).trim();
  const appointmentTitle = getSingleParam(params.title).trim();
  const appointmentNotes = getSingleParam(params.notes).trim();
  const hasLinkedAppointment = Boolean(appointmentId);

  useEffect(() => {
    if (didCreate.current) return;
    didCreate.current = true;

    const create = async () => {
      try {
        const quote = await save.mutateAsync({
          title: appointmentTitle || 'Nuevo trabajo',
          client_name: '-',
          notes: appointmentNotes || null,
          status: 'pending',
        });

        if (!hasLinkedAppointment) {
          router.replace({ pathname: '/quotes/[id]', params: { id: quote.id, fromNew: '1' } });
          return;
        }

        try {
          await linkAppointment.mutateAsync({
            appointmentId,
            quoteId: quote.id,
            title: appointmentTitle || 'Nuevo trabajo',
            notes: appointmentNotes || null,
          });
          router.replace({ pathname: '/quotes/[id]', params: { id: quote.id, fromNew: '1' } });
        } catch (linkError) {
          toast.error(toUserErrorMessage(linkError, 'El trabajo se creo, pero no se pudo vincular al turno.'));
          router.replace({ pathname: '/quotes/[id]', params: { id: quote.id, linkWarning: '1' } });
        }
      } catch (error) {
        toast.error(toUserErrorMessage(error, 'No se pudo crear el trabajo.'));
        router.back();
      }
    };

    create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppScreen title="Nuevo trabajo">
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Creando trabajo...</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 60,
  },
  loadingText: {
    color: '#5F6A76',
  },
});
