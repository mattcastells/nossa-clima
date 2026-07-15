import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Icon, Text, TextInput } from 'react-native-paper';

import { useToastMessageEffect } from '@/components/AppToastProvider';
import { getAppointmentClientLabel } from '@/features/appointments/calendarShared';
import type { WorkAgenda } from '@/features/appointments/useWorkAgenda';
import { quoteStatusAccent } from '@/features/quotes/status';
import { dayHeadingLabel, maskTimeInput, normalizeOptionalTimeInput, toHumanDate } from '@/lib/dateTimeInput';
import { toUserErrorMessage } from '@/lib/errors';
import { formatTimeShort } from '@/lib/format';
import { FONT_MONO, FONT_SANS_EXTRABOLD, useAppTheme } from '@/theme';

/**
 * Agenda del día seleccionado: timeline por hora, con el alta rápida de turno.
 * El selector de semana vive en el encabezado (ver WeekSelector) y comparte
 * estado a través de useWorkAgenda.
 */
export const WorkCalendarCard = ({ agenda, showQuickForm, onCloseQuickForm }: {
  agenda: WorkAgenda;
  showQuickForm: boolean;
  onCloseQuickForm: () => void;
}) => {
  const router = useRouter();
  const theme = useAppTheme();
  const { selectedDate, dayAppointments, isLoading, createAppointment, deleteAppointment } = agenda;

  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  useToastMessageEffect(message, () => setMessage(null));

  const createQuickAppointment = async () => {
    try {
      const normalizedTitle = title.trim();
      if (!normalizedTitle) throw new Error('El título es obligatorio.');
      const normalizedStartsAt = normalizeOptionalTimeInput(startsAt);
      await createAppointment.mutateAsync({
        quote_id: null,
        title: normalizedTitle,
        notes: notes.trim() ? notes.trim() : null,
        scheduled_for: selectedDate,
        starts_at: normalizedStartsAt,
        ends_at: null,
        status: 'scheduled',
        store_id: null,
      });
      setTitle('');
      setStartsAt('');
      setNotes('');
      onCloseQuickForm();
      setMessage('Turno agendado.');
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo agendar el turno.'));
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.dayHeading, { color: theme.colors.textMuted }]}>
        {dayHeadingLabel(selectedDate)} · {dayAppointments.length} turno{dayAppointments.length === 1 ? '' : 's'}
      </Text>

      {isLoading ? <Text style={{ color: theme.colors.textMuted }}>Cargando turnos…</Text> : null}

      {!isLoading && dayAppointments.length === 0 && !showQuickForm ? (
        <View style={styles.emptyState}>
          <Icon source="calendar-blank-outline" size={38} color={theme.colors.borderSoft} />
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No hay turnos para esta fecha.</Text>
        </View>
      ) : null}

      {dayAppointments.map((appointment) => {
        const accent = appointment.quote ? quoteStatusAccent(appointment.quote.status) : null;
        const barColor = accent ? accent.textColor : theme.colors.accent;
        const timeLabel = appointment.starts_at ? formatTimeShort(appointment.starts_at) : '· ·';
        const clientLabel = getAppointmentClientLabel(appointment);

        return (
            <View
              key={appointment.id}
              style={[
                styles.apptCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft, borderLeftColor: barColor },
              ]}
            >
              <View style={styles.apptTitleRow}>
                <Text style={[styles.apptTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={2}>
                  {appointment.quote ? appointment.quote.title : appointment.title}
                </Text>
                <Text style={[styles.timelineTime, { color: theme.colors.primary }]}>{timeLabel}</Text>
              </View>
              {clientLabel ? (
                <View style={styles.apptMetaRow}>
                  <Icon source="account-outline" size={14} color={theme.colors.textMuted} />
                  <Text style={[styles.apptMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {clientLabel}
                  </Text>
                </View>
              ) : null}
              <View style={styles.apptActions}>
                {appointment.quote_id ? (
                  <Button compact mode="text" textColor={theme.colors.accentStrong} onPress={() => router.push(`/quotes/${appointment.quote_id}`)}>
                    Ver trabajo
                  </Button>
                ) : (
                  <Button
                    compact
                    mode="text"
                    textColor={theme.colors.accentStrong}
                    onPress={() =>
                      router.push({
                        pathname: '/quotes/new',
                        params: {
                          appointmentId: appointment.id,
                          scheduledFor: appointment.scheduled_for,
                          startsAt: appointment.starts_at ?? '',
                          title: appointment.title,
                          notes: appointment.notes ?? '',
                        },
                      })
                    }
                  >
                    Crear trabajo
                  </Button>
                )}
                <Button
                  compact
                  mode="text"
                  textColor={theme.colors.error}
                  onPress={async () => {
                    try {
                      await deleteAppointment.mutateAsync(appointment.id);
                      setMessage('Turno eliminado.');
                    } catch (error) {
                      setMessage(toUserErrorMessage(error, 'No se pudo eliminar el turno.'));
                    }
                  }}
                >
                  Borrar
                </Button>
              </View>
            </View>
        );
      })}

      {showQuickForm ? (
        <Card mode="outlined" style={[styles.quickCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
          <Card.Content style={styles.quickForm}>
            <Text variant="titleSmall" style={{ color: theme.colors.titleOnSoft }}>
              Nuevo turno · {toHumanDate(selectedDate)}
            </Text>
            <TextInput
              mode="outlined"
              label="Título"
              value={title}
              onChangeText={setTitle}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
            />
            <TextInput
              mode="outlined"
              label="Hora (HH:mm)"
              value={startsAt}
              onChangeText={(value) => setStartsAt(maskTimeInput(value))}
              placeholder="09:30"
              keyboardType="number-pad"
              maxLength={5}
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
            />
            <TextInput
              mode="outlined"
              label="Notas (opcional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              outlineStyle={styles.inputOutline}
              activeOutlineColor={theme.colors.accent}
            />
            <Button
              mode="contained"
              buttonColor={theme.colors.accent}
              textColor={theme.colors.onAccent}
              style={styles.primaryAction}
              contentStyle={styles.primaryActionContent}
              loading={createAppointment.isPending}
              disabled={createAppointment.isPending}
              onPress={createQuickAppointment}
            >
              Agendar turno
            </Button>
          </Card.Content>
        </Card>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { gap: 14 },
  dayHeading: {
    fontSize: 12,
    fontFamily: FONT_SANS_EXTRABOLD,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  apptTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  timelineTime: {
    paddingTop: 2,
    fontSize: 14,
    fontFamily: FONT_MONO,
    fontVariant: ['tabular-nums'],
  },
  apptCard: {
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 3,
  },
  apptTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: FONT_SANS_EXTRABOLD },
  apptMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  apptMeta: { fontSize: 13, lineHeight: 17, flex: 1 },
  apptActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  quickCard: { borderRadius: 16, borderWidth: 1 },
  quickForm: { gap: 12, paddingVertical: 4 },
  inputOutline: { borderRadius: 12 },
  primaryAction: { borderRadius: 12, marginTop: 2 },
  primaryActionContent: { minHeight: 46 },
});
