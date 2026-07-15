import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Icon, IconButton, Text, TextInput } from 'react-native-paper';

import { useToastMessageEffect } from '@/components/AppToastProvider';
import { CALENDAR_WEEKDAY_LABELS, getAppointmentClientLabel } from '@/features/appointments/calendarShared';
import { useAppointmentsInMonth, useCreateAppointment, useDeleteAppointment } from '@/features/appointments/hooks';
import { useNotificationSync } from '@/features/appointments/useNotificationSync';
import { quoteStatusAccent, quoteStatusLabel } from '@/features/quotes/status';
import { formatIsoDate, getCalendarCells, maskTimeInput, monthLabel, normalizeOptionalTimeInput, toHumanDate } from '@/lib/dateTimeInput';
import { toUserErrorMessage } from '@/lib/errors';
import { formatTimeShort } from '@/lib/format';
import { useAppTheme } from '@/theme';

const getCurrentMonthAnchor = (): Date => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
};

const getCurrentSelectedDate = (): string => formatIsoDate(new Date());

export const WorkCalendarCard = () => {
  const router = useRouter();
  const theme = useAppTheme();
  const calendarColors = getCalendarColors(theme);
  const isFocused = useIsFocused();
  const [monthAnchor, setMonthAnchor] = useState(getCurrentMonthAnchor);

  // Sync local notifications with upcoming appointments from Supabase on mount
  useNotificationSync();
  const [selectedDate, setSelectedDate] = useState(getCurrentSelectedDate);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [showQuickForm, setShowQuickForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useToastMessageEffect(message, () => setMessage(null));

  const todayDateKey = formatIsoDate(new Date());

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

  const goToToday = () => {
    setMonthAnchor(getCurrentMonthAnchor());
    setSelectedDate(getCurrentSelectedDate());
  };

  const isCurrentMonth =
    monthAnchor.getFullYear() === new Date().getFullYear() && monthAnchor.getMonth() === new Date().getMonth();

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
      setShowQuickForm(false);
      setMessage('Turno agendado.');
    } catch (error) {
      setMessage(toUserErrorMessage(error, 'No se pudo agendar el turno.'));
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Month card */}
      <Card style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
        <Card.Content style={styles.monthContent}>
          <View style={styles.monthHeader}>
            <Text variant="titleMedium" style={[styles.monthLabel, { color: theme.colors.titleOnSoft }]}>
              {monthLabel(monthAnchor)}
            </Text>
            <View style={styles.monthNav}>
              {!isCurrentMonth ? (
                <Button compact mode="text" onPress={goToToday} textColor={theme.colors.accentStrong}>
                  Hoy
                </Button>
              ) : null}
              <IconButton
                icon="chevron-left"
                size={22}
                accessibilityLabel="Mes anterior"
                onPress={() => moveMonth(-1)}
                style={styles.monthIconButton}
                iconColor={theme.colors.textMuted}
              />
              <IconButton
                icon="chevron-right"
                size={22}
                accessibilityLabel="Mes siguiente"
                onPress={() => moveMonth(1)}
                style={styles.monthIconButton}
                iconColor={theme.colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.weekHeader}>
            {CALENDAR_WEEKDAY_LABELS.map((label) => (
              <Text key={label} style={[styles.weekLabel, { color: theme.colors.textMuted }]}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarCells.map((day, index) => {
              const dateKey = day == null ? null : formatIsoDate(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), day));
              const selected = dateKey != null && dateKey === selectedDate;
              const isToday = dateKey != null && dateKey === todayDateKey;
              const count = dateKey != null ? appointmentsByDate.get(dateKey) ?? 0 : 0;
              const markers = Math.min(count, 3);

              return (
                <View key={`day-${index}-${day ?? 'empty'}`} style={styles.dayCell}>
                  {dateKey ? (
                    <Pressable onPress={() => setSelectedDate(dateKey)} style={({ pressed }) => [styles.dayPressable, pressed && styles.dayPressablePressed]}>
                      <View
                        style={[
                          styles.dayBubble,
                          selected && { backgroundColor: theme.colors.primary },
                          isToday && !selected && [styles.todayBubble, { borderColor: theme.colors.accent }],
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayNumber,
                            { color: selected ? '#FFFFFF' : isToday ? theme.colors.accentStrong : theme.colors.onSurface },
                            (isToday || selected) && styles.todayDayNumber,
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                      <View style={styles.dayMarkersRow}>
                        {Array.from({ length: markers }).map((_, markerIndex) => (
                          <View
                            key={`${dateKey}-marker-${markerIndex}`}
                            style={[styles.dayMarker, { backgroundColor: selected ? theme.colors.accent : theme.colors.softBlueStrong }]}
                          />
                        ))}
                      </View>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card.Content>
      </Card>

      {/* Agenda for selected day */}
      <View style={styles.agendaHeaderRow}>
        <Text style={[styles.agendaHeading, { color: theme.colors.textMuted }]}>
          {toHumanDate(selectedDate)} · {selectedDateAppointments.length} turno{selectedDateAppointments.length === 1 ? '' : 's'}
        </Text>
        <IconButton
          icon="plus"
          mode="contained"
          size={20}
          accessibilityLabel="Nuevo turno"
          containerColor={theme.colors.accent}
          iconColor={theme.colors.onAccent}
          style={styles.addButton}
          onPress={() => setShowQuickForm((current) => !current)}
        />
      </View>

      {appointmentsQuery.isLoading ? (
        <Text style={{ color: theme.colors.textMuted }}>Cargando turnos…</Text>
      ) : selectedDateAppointments.length === 0 && !showQuickForm ? (
        <View style={styles.emptyState}>
          <Icon source="calendar-blank-outline" size={38} color={theme.colors.borderSoft} />
          <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No hay turnos para esta fecha.</Text>
        </View>
      ) : null}

      {selectedDateAppointments.map((appointment) => {
        const accent = appointment.quote ? quoteStatusAccent(appointment.quote.status) : null;
        const barColor = accent ? accent.textColor : theme.colors.accent;
        const timeLabel = appointment.starts_at ? formatTimeShort(appointment.starts_at) : '· ·';
        return (
          <View key={appointment.id} style={styles.timelineRow}>
            <Text style={[styles.timelineTime, { color: theme.colors.primary }]}>{timeLabel}</Text>
            <Card mode="outlined" style={[styles.apptCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft, borderLeftColor: barColor }]}>
              <Card.Content style={styles.apptContent}>
                <View style={styles.apptHeaderRow}>
                  <Text style={[styles.apptTitle, { color: theme.colors.titleOnSoft }]} numberOfLines={1}>
                    {appointment.quote ? appointment.quote.title : appointment.title}
                  </Text>
                  {accent ? (
                    <View style={[styles.statusBadge, { backgroundColor: accent.backgroundColor, borderColor: accent.borderColor }]}>
                      <Text style={[styles.statusBadgeText, { color: accent.textColor }]}>{quoteStatusLabel(appointment.quote?.status)}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.apptMetaRow}>
                  <Icon source="account-outline" size={15} color={theme.colors.textMuted} />
                  <Text style={[styles.apptMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {getAppointmentClientLabel(appointment)}
                  </Text>
                </View>
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
              </Card.Content>
            </Card>
          </View>
        );
      })}

      {/* Quick add */}
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
  card: { borderRadius: 20, borderWidth: 1 },
  monthContent: { gap: 12, paddingVertical: 6 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNav: { flexDirection: 'row', alignItems: 'center' },
  monthIconButton: { margin: 0 },
  monthLabel: { textTransform: 'capitalize', fontWeight: '800' },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  weekLabel: { width: `${100 / 7}%`, textAlign: 'center', fontWeight: '700', fontSize: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  dayPressable: { width: '100%', alignItems: 'center', justifyContent: 'flex-start', paddingVertical: 2 },
  dayPressablePressed: { opacity: 0.72 },
  dayBubble: { width: 34, height: 34, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  todayBubble: { borderWidth: 2 },
  dayNumber: { textAlign: 'center', fontSize: 14, lineHeight: 16, fontWeight: '600' },
  todayDayNumber: { fontWeight: '800' },
  dayMarkersRow: { minHeight: 8, marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayMarker: { width: 4, height: 4, borderRadius: 999 },
  agendaHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agendaHeading: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  addButton: { margin: 0, borderRadius: 12 },
  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  timelineRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineTime: { width: 46, textAlign: 'right', paddingTop: 14, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  apptCard: { flex: 1, borderRadius: 14, borderWidth: 1, borderLeftWidth: 3 },
  apptContent: { gap: 6, paddingVertical: 10 },
  apptHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  apptTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  statusBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  apptMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  apptMeta: { flex: 1, fontSize: 13, lineHeight: 17 },
  apptActions: { marginTop: 2, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginLeft: -8 },
  quickCard: { borderRadius: 18, borderWidth: 1 },
  quickForm: { gap: 12, paddingVertical: 6 },
  inputOutline: { borderRadius: 12 },
  primaryAction: { borderRadius: 12, marginTop: 2 },
  primaryActionContent: { minHeight: 46 },
});
