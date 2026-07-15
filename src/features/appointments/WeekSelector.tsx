import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import type { WorkAgenda } from '@/features/appointments/useWorkAgenda';
import { parseIsoDate } from '@/lib/dateTimeInput';
import { FONT_SANS_BOLD, FONT_SANS_EXTRABOLD, useAppTheme } from '@/theme';

const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/** Selector de días de la semana del encabezado de la agenda. */
export const WeekSelector = ({ agenda }: { agenda: WorkAgenda }) => {
  const theme = useAppTheme();
  const { weekDays, selectedDate, selectDate, countsByDate, todayDateKey } = agenda;

  return (
    <View style={styles.row}>
      {weekDays.map((isoDate, index) => {
        const selected = isoDate === selectedDate;
        const isPast = isoDate < todayDateKey;
        const hasAppointments = (countsByDate.get(isoDate) ?? 0) > 0;
        const dayNumber = parseIsoDate(isoDate).getDate();

        return (
          <Pressable
            key={isoDate}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${WEEKDAY_LABELS[index]} ${dayNumber}`}
            onPress={() => selectDate(isoDate)}
            style={({ pressed }) => [
              styles.day,
              selected && { backgroundColor: theme.colors.primary },
              pressed && !selected && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.weekday,
                { color: selected ? theme.colors.onPrimary : isPast ? theme.colors.textMuted : theme.colors.textMuted },
              ]}
            >
              {WEEKDAY_LABELS[index]}
            </Text>
            <Text
              style={[
                styles.dayNumber,
                { color: selected ? theme.colors.onPrimary : isPast ? theme.colors.textMuted : theme.colors.titleOnSoft },
                selected && styles.dayNumberSelected,
              ]}
            >
              {dayNumber}
            </Text>
            {/* El punto marca que ese día tiene turnos; se reserva el alto para que no salte. */}
            <View
              style={[
                styles.dot,
                hasAppointments && { backgroundColor: selected ? theme.colors.accent : theme.colors.outline },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 14,
  },
  pressed: { opacity: 0.6 },
  weekday: { fontSize: 11, lineHeight: 14 },
  dayNumber: { fontSize: 16, lineHeight: 20, fontFamily: FONT_SANS_BOLD },
  dayNumberSelected: { fontFamily: FONT_SANS_EXTRABOLD },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 3,
    backgroundColor: 'transparent',
  },
});
