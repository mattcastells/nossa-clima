import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text } from 'react-native-paper';

import { CALENDAR_WEEKDAY_LABELS } from '@/features/appointments/calendarShared';
import { useAppointmentsInMonth } from '@/features/appointments/hooks';
import type { WorkAgenda } from '@/features/appointments/useWorkAgenda';
import { formatIsoDate, getCalendarCells, monthLabel, parseIsoDate } from '@/lib/dateTimeInput';
import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, useAppTheme } from '@/theme';

const monthAnchorOf = (isoDate: string): Date => {
  const date = parseIsoDate(isoDate);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

/**
 * Calendario mensual al pie de la agenda, para saltar a cualquier fecha sin
 * estar limitado a la semana del selector de arriba. Comparte la selección con
 * el resto de la pantalla vía useWorkAgenda: tocar un día mueve el timeline y
 * la semana de arriba lo sigue.
 */
export const MonthCalendar = ({ agenda }: { agenda: WorkAgenda }) => {
  const theme = useAppTheme();
  const { selectedDate, selectDate, todayDateKey } = agenda;
  const [monthAnchor, setMonthAnchor] = useState(() => monthAnchorOf(selectedDate));

  // Si la selección cambia desde el selector de semana, el mes mostrado la sigue.
  useEffect(() => {
    const next = monthAnchorOf(selectedDate);
    setMonthAnchor((current) =>
      current.getFullYear() === next.getFullYear() && current.getMonth() === next.getMonth() ? current : next,
    );
  }, [selectedDate]);

  // Mismo query key que usa la agenda cuando el mes coincide: React Query lo comparte.
  const monthQuery = useAppointmentsInMonth(monthAnchor);
  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    (monthQuery.data ?? []).forEach((appointment) => {
      map.set(appointment.scheduled_for, (map.get(appointment.scheduled_for) ?? 0) + 1);
    });
    return map;
  }, [monthQuery.data]);

  const cells = useMemo(() => getCalendarCells(monthAnchor), [monthAnchor]);

  const isCurrentMonth =
    monthAnchor.getFullYear() === parseIsoDate(todayDateKey).getFullYear() &&
    monthAnchor.getMonth() === parseIsoDate(todayDateKey).getMonth();

  const moveMonth = (delta: number) => {
    setMonthAnchor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}>
      <View style={styles.header}>
        <Text style={[styles.monthLabel, { color: theme.colors.titleOnSoft }]}>{monthLabel(monthAnchor)}</Text>
        <View style={styles.nav}>
          {!isCurrentMonth ? (
            <Button compact mode="text" textColor={theme.colors.accentStrong} onPress={() => selectDate(todayDateKey)}>
              Hoy
            </Button>
          ) : null}
          <IconButton
            icon="chevron-left"
            size={22}
            accessibilityLabel="Mes anterior"
            onPress={() => moveMonth(-1)}
            style={styles.navButton}
            iconColor={theme.colors.textMuted}
          />
          <IconButton
            icon="chevron-right"
            size={22}
            accessibilityLabel="Mes siguiente"
            onPress={() => moveMonth(1)}
            style={styles.navButton}
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

      <View style={styles.grid}>
        {cells.map((day, index) => {
          const dateKey =
            day == null ? null : formatIsoDate(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), day));
          const selected = dateKey != null && dateKey === selectedDate;
          const isToday = dateKey != null && dateKey === todayDateKey;
          const hasAppointments = dateKey != null && (countsByDate.get(dateKey) ?? 0) > 0;

          return (
            <View key={`cell-${index}-${day ?? 'x'}`} style={styles.cell}>
              {dateKey ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Día ${day}`}
                  onPress={() => selectDate(dateKey)}
                  style={({ pressed }) => [styles.dayPressable, pressed && styles.pressed]}
                >
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
                        { color: selected ? theme.colors.onPrimary : isToday ? theme.colors.accentStrong : theme.colors.titleOnSoft },
                        (selected || isToday) && styles.dayNumberStrong,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                  {/* El punto marca días con turnos; el alto queda reservado para que la grilla no salte. */}
                  <View
                    style={[
                      styles.dot,
                      hasAppointments && { backgroundColor: selected ? theme.colors.accent : theme.colors.outline },
                    ]}
                  />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 4,
  },
  monthLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONT_SANS_EXTRABOLD,
  },
  nav: { flexDirection: 'row', alignItems: 'center' },
  navButton: { margin: 0 },
  weekHeader: { flexDirection: 'row' },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontFamily: FONT_SANS_BOLD,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayPressable: { alignItems: 'center' },
  pressed: { opacity: 0.6 },
  dayBubble: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBubble: { borderWidth: 1.5 },
  dayNumber: { fontSize: 14 },
  dayNumberStrong: { fontFamily: FONT_SANS_EXTRABOLD },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 1,
    backgroundColor: 'transparent',
  },
});
