import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, TextInput } from 'react-native-paper';

import { CalendarPickerDialog } from '@/components/CalendarPickerDialog';
import { maskDateInput, maskTimeInput } from '@/lib/dateTimeInput';
import { useAppTheme } from '@/theme';

interface Props {
  scheduleDate: string;
  setScheduleDate: (value: string) => void;
  scheduleTime: string;
  setScheduleTime: (value: string) => void;
  calendarVisible: boolean;
  setCalendarVisible: (visible: boolean) => void;
  disabled: boolean;
}

export function ScheduleDateSection({
  scheduleDate,
  setScheduleDate,
  scheduleTime,
  setScheduleTime,
  calendarVisible,
  setCalendarVisible,
  disabled,
}: Props) {
  const theme = useAppTheme();

  return (
    <>
      <Card mode="outlined" style={styles.sectionCard}>
        <Card.Content style={styles.sectionContent}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium">Fecha</Text>
            <Text style={[styles.helperText, { color: theme.colors.textMuted }]}>
              Opcional. Si la completas, el trabajo tambien queda agendado.
            </Text>
          </View>

          <TextInput
            mode="outlined"
            label="Fecha (DD-MM-AAAA)"
            value={scheduleDate}
            onChangeText={(value) => setScheduleDate(maskDateInput(value))}
            placeholder="12-03-2026"
            keyboardType="number-pad"
            maxLength={10}
            outlineStyle={styles.inputOutline}
            disabled={disabled}
            right={
              <TextInput.Icon icon="calendar-month-outline" onPress={() => setCalendarVisible(true)} />
            }
          />
          <TextInput
            mode="outlined"
            label="Hora (opcional)"
            value={scheduleTime}
            onChangeText={(value) => setScheduleTime(maskTimeInput(value))}
            placeholder="09:30"
            keyboardType="number-pad"
            maxLength={5}
            outlineStyle={styles.inputOutline}
            disabled={disabled}
          />
          <View style={styles.actionsRow}>
            <Button mode="text" compact onPress={() => setCalendarVisible(true)} disabled={disabled}>
              Elegir fecha
            </Button>
            <Button
              mode="text"
              compact
              onPress={() => {
                setScheduleDate('');
                setScheduleTime('');
              }}
              disabled={disabled || (!scheduleDate.trim() && !scheduleTime.trim())}
            >
              Limpiar
            </Button>
          </View>
        </Card.Content>
      </Card>

      <CalendarPickerDialog
        visible={calendarVisible}
        value={scheduleDate}
        onDismiss={() => setCalendarVisible(false)}
        onSelect={setScheduleDate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: 12,
  },
  sectionContent: {
    gap: 12,
    paddingVertical: 10,
  },
  sectionHeader: {
    gap: 4,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
  },
  inputOutline: {
    borderRadius: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
});
