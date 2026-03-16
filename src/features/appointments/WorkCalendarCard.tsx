import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, Text, TextInput } from 'react-native-paper';

import { useToastMessageEffect } from '@/components/AppToastProvider';
import { useAppointmentsInMonth, useCreateAppointment, useDeleteAppointment } from '@/features/appointments/hooks';
import { quoteStatusAccent, quoteStatusLabel } from '@/features/quotes/status';
import { formatIsoDate, getCalendarCells, maskTimeInput, monthLabel, normalizeOptionalTimeInput, toHumanDate } from '@/lib/dateTimeInput';
import { toUserErrorMessage } from '@/lib/errors';
import { formatDateAr, formatTimeShort } from '@/lib/format';
import { useAppTheme } from '@/theme';

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const getAppointmentClientLabel = (appointment: { quote: { client_name: string } | null; quote_id: string | null }): string =>
  appointment.quote?.client_name ?? (appointment.quote_id ? '-' : 'Sin cliente');

const getAppointmentDescription = (
  appointment: {
    title: string;
    notes: string | null;
    quote: { title: string; notes: string | null } | null;
  },
): string => {
  const description = appointment.notes?.trim() || appointment.quote?.notes?.trim() || appointment.quote?.title?.trim() || appointment.title.trim();
  return description || 'Sin descripcion';
};

const getCurrentMonthAnchor = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
};

const getCurrentSelectedDate = (): string => formatIsoDate(new Date());

export const WorkCalendarCard = () => {
  const router = useRouter();
  const theme = useAppTheme();
  const isFocused = useIsFocused();
  const [monthAnchor, setMonthAnchor] = useState(getCurrentMonthAnchor);
  const [selectedDate, setSelectedDate] = useState(getCurrentSelectedDate);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  useToastMessageEffect(message, () => setMessage(null));

  useEffect(() => {
    if (!isFocused) return;

    setMonthAnchor(getCurrentMonthAnchor());
    setSelectedDate(getCurrentSelectedDate());
  }, [isFocused]);

  const appointmentsQuery = useAppointmentsInMonth(monthAnchor);
  const createAppointment = useCreateAppointment();
  const deleteAppointment = useDeleteAppointment();

  const calendarCells = useMemo(() => getCalendarCells(monthAnchor), [monthAnchor]);

  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, number>();
    (appointmentsQuery.data ?? []).forEach((appointment) => {
      map.set(appointment.scheduled_for, (map.get(appointment.scheduled_for) ?? 0) + 1);
    });
    return map;
  }, [appointmentsQuery.data]);

  const selectedDateAppointments = useMemo(
    () =>
      (appointmentsQuery.data ?? [])
        .filter((appointment) => appointment.scheduled_for === selectedDate)
        .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? '')),
    [appointmentsQuery.data, selectedDate],
  );

  const moveMonth = (delta: number) => {
    const nextAnchor = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + delta, 1);
    setMonthAnchor(nextAnchor);
    setSelectedDate(formatIsoDate(nextAnchor));
  };

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.monthHeader}>
          <Text variant="titleMedium" style={styles.monthLabel}>
            {monthLabel(monthAnchor)}
          </Text>
          <View style={styles.monthNav}>
            <IconButton icon="arrow-left" size={18} accessibilityLabel="Mes anterior" onPress={() => moveMonth(-1)} style={styles.monthIconButton} />
            <IconButton icon="arrow-right" size={18} accessibilityLabel="Mes siguiente" onPress={() => moveMonth(1)} style={styles.monthIconButton} />
          </View>
        </View>

        <View style={styles.weekHeader}>
          {WEEKDAY_LABELS.map((label) => (
            <Text key={label} style={styles.weekLabel}>
              {label}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {calendarCells.map((day, index) => {
            const dateKey = day == null ? null : formatIsoDate(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), day));
            const selected = dateKey != null && dateKey === selectedDate;
            const count = dateKey != null ? appointmentsByDate.get(dateKey) ?? 0 : 0;
            const markers = Math.min(count, 3);

            return (
              <View key={`day-${index}-${day ?? 'empty'}`} style={styles.dayCell}>
                {dateKey ? (
                  <Pressable
                    onPress={() => setSelectedDate(dateKey)}
                    style={({ pressed }) => [styles.dayPressable, pressed && styles.dayPressablePressed]}
                  >
                    <View style={[styles.dayBubble, selected && { backgroundColor: theme.colors.softBlue }]}>
                      <Text style={[styles.dayNumber, { color: selected ? theme.colors.primary : theme.colors.titleOnSoft }]}>{day}</Text>
                    </View>
                    <View style={styles.dayMarkersRow}>
                      {Array.from({ length: markers }).map((_, markerIndex) => (
                        <View
                          key={`${dateKey}-marker-${markerIndex}`}
                          style={[styles.dayMarker, { backgroundColor: selected ? theme.colors.secondary : theme.colors.primary }]}
                        />
                      ))}
                    </View>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text variant="titleMedium">Trabajos del {toHumanDate(selectedDate)}</Text>
        {appointmentsQuery.isLoading && <Text style={{ color: theme.colors.textMuted }}>Cargando trabajos...</Text>}
        {!appointmentsQuery.isLoading && selectedDateAppointments.length === 0 && (
          <Text style={{ color: theme.colors.textMuted }}>No hay trabajos cargados para esta fecha.</Text>
        )}
        {!appointmentsQuery.isLoading &&
          selectedDateAppointments.map((appointment) => (
            <Card key={appointment.id} mode="outlined" style={styles.appointmentCard}>
              <Card.Content style={styles.appointmentContent}>
                {appointment.quote ? (
                  <View style={styles.appointmentHeaderRow}>
                    <Text style={[styles.appointmentTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                      {appointment.quote.title}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: quoteStatusAccent(appointment.quote.status).backgroundColor,
                          borderColor: quoteStatusAccent(appointment.quote.status).borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: quoteStatusAccent(appointment.quote.status).textColor }]}>
                        {quoteStatusLabel(appointment.quote.status)}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.appointmentTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
                    {appointment.title}
                  </Text>
                )}
                <View style={styles.metaBlock}>
                  <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Cliente:</Text>
                  <Text style={{ color: theme.colors.onSurface }}>{getAppointmentClientLabel(appointment)}</Text>
                </View>
                <View style={styles.metaBlock}>
                  <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Fecha y hora:</Text>
                  <Text style={{ color: theme.colors.onSurface }}>
                    {`${formatDateAr(appointment.scheduled_for)}${appointment.starts_at ? ` - ${formatTimeShort(appointment.starts_at)}` : ''}`}
                  </Text>
                </View>
                <View style={styles.metaBlock}>
                  <Text style={[styles.metaLabel, { color: theme.colors.textMuted }]}>Descripcion:</Text>
                  <Text style={{ color: theme.colors.onSurface }}>{getAppointmentDescription(appointment)}</Text>
                </View>
                <View style={styles.appointmentActions}>
                  {appointment.quote_id ? (
                    <Button compact mode="text" onPress={() => router.push(`/quotes/${appointment.quote_id}`)}>
                      Ver presupuesto
                    </Button>
                  ) : (
                    <Button
                      compact
                      mode="text"
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
                    textColor="#B3261E"
                    onPress={async () => {
                      try {
                        await deleteAppointment.mutateAsync(appointment.id);
                        setMessage('Trabajo eliminado del calendario.');
                      } catch (error) {
                        setMessage(toUserErrorMessage(error, 'No se pudo eliminar el trabajo.'));
                      }
                    }}
                  >
                    Borrar
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))}

        <View style={styles.quickForm}>
          <Text variant="titleMedium">Nuevo turno rapido</Text>
          <TextInput mode="outlined" label="Trabajo / turno" value={title} onChangeText={setTitle} />
          <TextInput
            mode="outlined"
            label="Hora (HH:mm)"
            value={startsAt}
            onChangeText={(value) => setStartsAt(maskTimeInput(value))}
            placeholder="09:30"
            keyboardType="number-pad"
            maxLength={5}
          />
          <TextInput mode="outlined" label="Notas (opcional)" value={notes} onChangeText={setNotes} multiline />
          <Button
            mode="contained"
            style={styles.primaryAction}
            contentStyle={styles.primaryActionContent}
            loading={createAppointment.isPending}
            disabled={createAppointment.isPending}
            onPress={async () => {
              try {
                const normalizedTitle = title.trim();
                if (!normalizedTitle) {
                  throw new Error('El titulo del turno es obligatorio.');
                }

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
                setMessage('Turno agendado.');
              } catch (error) {
                setMessage(toUserErrorMessage(error, 'No se pudo agendar el turno.'));
              }
            }}
          >
            Agendar turno
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 6,
  },
  content: {
    gap: 12,
  },
  monthHeader: {
    gap: 8,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthIconButton: {
    margin: 0,
  },
  monthLabel: {
    textAlign: 'center',
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayPressable: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 2,
  },
  dayPressablePressed: {
    opacity: 0.72,
  },
  dayBubble: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
  },
  dayMarkersRow: {
    minHeight: 8,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dayMarker: {
    width: 4,
    height: 4,
    borderRadius: 999,
  },
  appointmentCard: {
    marginTop: 2,
  },
  appointmentContent: {
    gap: 8,
  },
  appointmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  appointmentTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  metaBlock: {
    gap: 2,
  },
  metaLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  appointmentActions: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickForm: {
    marginTop: 4,
    gap: 10,
    paddingBottom: 8,
  },
  primaryAction: {
    borderRadius: 999,
    marginTop: 2,
  },
  primaryActionContent: {
    minHeight: 44,
  },
});
