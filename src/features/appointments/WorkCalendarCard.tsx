import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Snackbar, Text, TextInput } from 'react-native-paper';

import { useAppointmentsInMonth, useCreateAppointment, useDeleteAppointment } from '@/features/appointments/hooks';
import { toUserErrorMessage } from '@/lib/errors';

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const formatLocalDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toHumanDate = (isoDate: string): string => {
  const [rawYear = '1970', rawMonth = '01', rawDay = '01'] = isoDate.split('-');
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const date = new Date(
    Number.isFinite(year) ? year : 1970,
    Number.isFinite(month) ? month - 1 : 0,
    Number.isFinite(day) ? day : 1,
  );
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getCalendarCells = (anchor: Date): Array<number | null> => {
  const firstDay = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();

  const cells: Array<number | null> = Array.from({ length: firstWeekday }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

const monthLabel = (anchor: Date): string =>
  anchor.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  });

const normalizeTime = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
    throw new Error('Hora invalida. Usa formato HH:mm.');
  }

  return `${trimmed}:00`;
};

export const WorkCalendarCard = () => {
  const router = useRouter();
  const [monthAnchor, setMonthAnchor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);

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
    setSelectedDate(formatLocalDate(nextAnchor));
  };

  return (
    <Card style={styles.card}>
      <Card.Content style={styles.content}>
        <View style={styles.monthHeader}>
          <Text variant="titleMedium" style={styles.monthLabel}>
            {monthLabel(monthAnchor)}
          </Text>
          <View style={styles.monthNav}>
            <Button compact mode="text" onPress={() => moveMonth(-1)} style={styles.monthButton} contentStyle={styles.monthButtonContent}>
              Anterior
            </Button>
            <Button compact mode="text" onPress={() => moveMonth(1)} style={styles.monthButton} contentStyle={styles.monthButtonContent}>
              Siguiente
            </Button>
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
            const dateKey =
              day == null ? null : formatLocalDate(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), day));
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
                    <View style={[styles.dayBubble, selected && styles.dayBubbleSelected]}>
                      <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>{day}</Text>
                    </View>
                    <View style={styles.dayMarkersRow}>
                      {Array.from({ length: markers }).map((_, markerIndex) => (
                        <View key={`${dateKey}-marker-${markerIndex}`} style={[styles.dayMarker, selected && styles.dayMarkerSelected]} />
                      ))}
                    </View>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        <Text variant="titleMedium">Trabajos del {toHumanDate(selectedDate)}</Text>
        {appointmentsQuery.isLoading && <Text>Cargando trabajos...</Text>}
        {!appointmentsQuery.isLoading && selectedDateAppointments.length === 0 && (
          <Text>No hay trabajos cargados para esta fecha.</Text>
        )}
        {!appointmentsQuery.isLoading &&
          selectedDateAppointments.map((appointment) => (
            <Card key={appointment.id} mode="outlined" style={styles.appointmentCard}>
              <Card.Content>
                <Text variant="titleSmall">
                  {appointment.starts_at ? appointment.starts_at.slice(0, 5) : '--:--'} - {appointment.title}
                </Text>
                {appointment.notes ? <Text>{appointment.notes}</Text> : null}
                <View style={styles.appointmentActions}>
                  {appointment.quote_id ? (
                    <Button compact onPress={() => router.push(`/quotes/${appointment.quote_id}`)}>
                      Ver detalle
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
                    style={styles.deleteButton}
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
          <TextInput mode="outlined" label="Hora (HH:mm)" value={startsAt} onChangeText={setStartsAt} />
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

                const normalizedStartsAt = normalizeTime(startsAt);

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

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage(null)}>
        {message}
      </Snackbar>
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
  monthButton: {
    flex: 1,
    minWidth: 0,
  },
  monthButtonContent: {
    minHeight: 36,
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
    color: '#4B5563',
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
    color: '#164E63',
  },
  dayBubbleSelected: {
    backgroundColor: '#E7DBFF',
  },
  dayNumberSelected: {
    fontWeight: '700',
    color: '#36245B',
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
    backgroundColor: '#18A7C7',
  },
  dayMarkerSelected: {
    backgroundColor: '#6A43B7',
  },
  appointmentCard: {
    marginTop: 2,
  },
  appointmentActions: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  deleteButton: {
    alignSelf: 'flex-end',
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
