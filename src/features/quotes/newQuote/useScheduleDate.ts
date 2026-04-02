import { useEffect, useState } from 'react';

interface UseScheduleDateOptions {
  scheduledFor: string;
  startsAt: string;
  hasLinkedAppointment: boolean;
}

export function useScheduleDate({ scheduledFor, startsAt, hasLinkedAppointment }: UseScheduleDateOptions) {
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [calendarVisible, setCalendarVisible] = useState(false);

  useEffect(() => {
    if (hasLinkedAppointment || !scheduledFor) return;
    const [year = '', month = '', day = ''] = scheduledFor.split('-');
    if (year && month && day) {
      setScheduleDate(`${day}-${month}-${year}`);
    }
    setScheduleTime(startsAt ? startsAt.slice(0, 5) : '');
  }, [hasLinkedAppointment, scheduledFor, startsAt]);

  return {
    scheduleDate,
    setScheduleDate,
    scheduleTime,
    setScheduleTime,
    calendarVisible,
    setCalendarVisible,
  };
}
