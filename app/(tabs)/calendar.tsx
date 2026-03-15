import { AppScreen } from '@/components/AppScreen';
import { WorkCalendarCard } from '@/features/appointments/WorkCalendarCard';

export default function CalendarScreen() {
  return (
    <AppScreen title="Calendario">
      <WorkCalendarCard />
    </AppScreen>
  );
}
