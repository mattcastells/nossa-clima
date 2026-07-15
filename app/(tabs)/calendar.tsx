import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { IconButton } from 'react-native-paper';

import { AppScreen } from '@/components/AppScreen';
import { MonthCalendar } from '@/features/appointments/MonthCalendar';
import { WeekSelector } from '@/features/appointments/WeekSelector';
import { WorkCalendarCard } from '@/features/appointments/WorkCalendarCard';
import { useWorkAgenda } from '@/features/appointments/useWorkAgenda';
import { useAppTheme } from '@/theme';

export default function CalendarScreen() {
  const theme = useAppTheme();
  const agenda = useWorkAgenda();
  const [showQuickForm, setShowQuickForm] = useState(false);

  return (
    <AppScreen
      title="Agenda"
      titleRight={
        <IconButton
          icon="plus"
          mode="contained"
          size={22}
          accessibilityLabel="Nuevo turno"
          containerColor={theme.colors.accent}
          iconColor={theme.colors.onAccent}
          style={styles.newButton}
          onPress={() => setShowQuickForm((current) => !current)}
        />
      }
      headerContent={<WeekSelector agenda={agenda} />}
    >
      <WorkCalendarCard agenda={agenda} showQuickForm={showQuickForm} onCloseQuickForm={() => setShowQuickForm(false)} />
      <MonthCalendar agenda={agenda} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  newButton: { margin: 0, borderRadius: 13 },
});
