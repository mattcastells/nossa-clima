import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Dialog, IconButton, Portal, Text } from 'react-native-paper';

import { AppDialog } from '@/components/AppDialog';
import { formatDisplayDate, formatIsoDate, getCalendarCells, monthLabel, parseDisplayDate } from '@/lib/dateTimeInput';
import { BRAND_BLUE, BRAND_BLUE_SOFT } from '@/theme';

const WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  visible: boolean;
  value: string;
  onDismiss: () => void;
  onSelect: (value: string) => void;
}

export const CalendarPickerDialog = ({ visible, value, onDismiss, onSelect }: Props) => {
  const selectedDate = parseDisplayDate(value) ?? new Date();
  const [monthAnchor, setMonthAnchor] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const selectedIso = formatIsoDate(selectedDate);
  const calendarCells = useMemo(() => getCalendarCells(monthAnchor), [monthAnchor]);

  useEffect(() => {
    if (!visible) return;
    const nextDate = parseDisplayDate(value) ?? new Date();
    setMonthAnchor(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
  }, [value, visible]);

  const moveMonth = (delta: number) => {
    setMonthAnchor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <Portal>
      <AppDialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>Elegir fecha</Dialog.Title>
        <Dialog.Content style={styles.content}>
          <View style={styles.monthHeader}>
            <IconButton icon="arrow-left" size={18} accessibilityLabel="Mes anterior" onPress={() => moveMonth(-1)} style={styles.monthNavButton} />
            <Text variant="titleMedium" style={styles.monthLabel}>
              {monthLabel(monthAnchor)}
            </Text>
            <IconButton icon="arrow-right" size={18} accessibilityLabel="Mes siguiente" onPress={() => moveMonth(1)} style={styles.monthNavButton} />
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
              const date = day == null ? null : new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), day);
              const dateKey = date ? formatIsoDate(date) : null;
              const selected = dateKey != null && dateKey === selectedIso;

              return (
                <View key={`dialog-day-${index}-${day ?? 'empty'}`} style={styles.dayCell}>
                  {date ? (
                    <Pressable
                      onPress={() => {
                        onSelect(formatDisplayDate(date));
                        onDismiss();
                      }}
                      style={({ pressed }) => [styles.dayPressable, pressed && styles.dayPressablePressed]}
                    >
                      <View style={[styles.dayBubble, selected && styles.dayBubbleSelected]}>
                        <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>{day}</Text>
                      </View>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Dialog.Content>
      </AppDialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthLabel: {
    flex: 1,
    textAlign: 'center',
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  monthNavButton: {
    margin: 0,
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
    paddingVertical: 2,
  },
  dayPressablePressed: {
    opacity: 0.72,
  },
  dayBubble: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubbleSelected: {
    backgroundColor: BRAND_BLUE_SOFT,
  },
  dayNumber: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '500',
    color: BRAND_BLUE,
  },
  dayNumberSelected: {
    fontWeight: '700',
  },
});
