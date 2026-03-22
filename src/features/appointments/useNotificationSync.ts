import { useEffect, useRef } from 'react';

import { listUpcomingAppointments } from '@/services/appointments';
import {
  cancelAllAppointmentReminders,
  scheduleAppointmentReminder,
} from '@/services/notifications';

/**
 * Syncs local notifications with upcoming appointments from Supabase.
 *
 * - Cancels all existing appointment reminders.
 * - Schedules new reminders for every future appointment that has a time set.
 *
 * Runs once when the component mounts (typically in the root layout or
 * the calendar screen when the app opens).
 */
export const useNotificationSync = () => {
  const syncedRef = useRef(false);

  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    const sync = async () => {
      try {
        const upcoming = await listUpcomingAppointments();
        await cancelAllAppointmentReminders();

        await Promise.all(
          upcoming.map((appointment) =>
            scheduleAppointmentReminder({
              id: appointment.id,
              scheduled_for: appointment.scheduled_for,
              starts_at: appointment.starts_at,
              title: appointment.title,
              quote_id: appointment.quote_id ?? null,
            }),
          ),
        );
      } catch {
        // Silent sync — failures must not interrupt the app
      }
    };

    void sync();
  }, []);
};
