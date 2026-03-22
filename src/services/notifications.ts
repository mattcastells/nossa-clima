import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Notifications are only supported on Android (and iOS). Web is a no-op. */
const IS_SUPPORTED = Platform.OS !== 'web';

/** Android notification channel ID for appointment reminders */
const CHANNEL_ID = 'appointment-reminders';

/** Prefix used for scheduled notification identifiers */
const NOTIFICATION_ID_PREFIX = 'appointment-';

/** How many hours before the appointment the reminder fires */
const REMINDER_HOURS_BEFORE = 2;

/**
 * Sets up the Android notification channel for appointment reminders.
 * Should be called once on app startup, before scheduling any notifications.
 * No-op on web.
 */
export const setupNotificationChannel = async (): Promise<void> => {
  if (!IS_SUPPORTED || Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Appointment reminders',
    description: 'Reminders 2 hours before each scheduled appointment or job.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#052653',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
};

/**
 * Requests notification permissions from the user.
 * Android 13+ (API 33) requires an explicit runtime permission.
 * Returns true if permissions were granted, or false on web.
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  if (!IS_SUPPORTED) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    android: {},
  });

  return status === 'granted';
};

/**
 * Builds the unique notification identifier for a given appointment.
 */
const buildNotificationId = (appointmentId: string): string =>
  `${NOTIFICATION_ID_PREFIX}${appointmentId}`;

export type AppointmentReminderPayload = {
  /** Appointment ID in the database */
  id: string;
  /** Appointment date in ISO format (YYYY-MM-DD) */
  scheduled_for: string;
  /** Start time in HH:mm:ss or HH:mm format (null if no time is set) */
  starts_at: string | null;
  /** Title of the appointment or its linked job */
  title: string;
  /** Linked job ID (used to navigate to the quote when the notification is tapped) */
  quote_id: string | null;
};

/**
 * Schedules a local notification 2 hours before the appointment.
 * If the appointment has no time set, no notification is scheduled.
 * If the calculated reminder time has already passed, no notification is scheduled.
 * No-op on web.
 */
export const scheduleAppointmentReminder = async (
  appointment: AppointmentReminderPayload,
): Promise<void> => {
  if (!IS_SUPPORTED) return;

  // No time defined → cannot determine an exact moment, skip
  if (!appointment.starts_at) return;

  const [dateYear, dateMonth, dateDay] = appointment.scheduled_for.split('-').map(Number);
  const [timeHour, timeMin] = appointment.starts_at.split(':').map(Number);

  if (!dateYear || !dateMonth || !dateDay || timeHour === undefined || timeMin === undefined) return;

  // Build the exact appointment date/time in device local time
  const appointmentDate = new Date(dateYear, dateMonth - 1, dateDay, timeHour, timeMin, 0, 0);

  // Calculate when to fire: REMINDER_HOURS_BEFORE hours before the appointment
  const reminderDate = new Date(appointmentDate.getTime() - REMINDER_HOURS_BEFORE * 60 * 60 * 1000);

  // If the reminder time has already passed, skip scheduling
  if (reminderDate.getTime() <= Date.now()) return;

  const notificationId = buildNotificationId(appointment.id);

  // Cancel any existing notification for this appointment (e.g. after rescheduling)
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});

  const timeLabel = `${String(timeHour).padStart(2, '0')}:${String(timeMin).padStart(2, '0')}`;

  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: appointment.title,
      body: `Hoy a las ${timeLabel} tenés un turno agendado.`,
      data: {
        appointmentId: appointment.id,
        quoteId: appointment.quote_id,
      },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderDate,
    },
  });
};

/**
 * Cancels the scheduled reminder for a specific appointment.
 * No-op on web.
 */
export const cancelAppointmentReminder = async (appointmentId: string): Promise<void> => {
  if (!IS_SUPPORTED) return;

  const notificationId = buildNotificationId(appointmentId);
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
};

/**
 * Cancels ALL scheduled appointment reminders.
 * Useful for performing a clean sync from scratch.
 * No-op on web.
 */
export const cancelAllAppointmentReminders = async (): Promise<void> => {
  if (!IS_SUPPORTED) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const appointmentNotifications = scheduled.filter((n: Notifications.NotificationRequest) =>
    n.identifier.startsWith(NOTIFICATION_ID_PREFIX),
  );

  await Promise.all(
    appointmentNotifications.map((n: Notifications.NotificationRequest) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}),
    ),
  );
};
