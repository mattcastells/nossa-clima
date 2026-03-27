import type { AppTheme } from '@/theme';

export const CALENDAR_WEEKDAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export const getCalendarColors = (theme: AppTheme) => ({
  panelBackground: theme.dark ? '#1A212B' : theme.colors.surface,
  panelBorder: theme.dark ? '#2F3B4A' : theme.colors.borderSoft,
  navButtonBackground: theme.dark ? '#202A35' : theme.colors.surfaceSoft,
  navButtonBorder: theme.dark ? '#344455' : theme.colors.borderSoft,
  navButtonIcon: theme.dark ? '#D5E0ED' : theme.colors.titleOnSoft,
  todayButtonText: theme.dark ? '#DCEBFF' : theme.colors.primary,
  monthLabel: theme.colors.titleOnSoft,
  weekdayLabel: theme.dark ? '#C4D1E0' : '#5E7186',
  selectedDayBackground: theme.dark ? '#314B68' : theme.colors.softBlue,
  selectedDayText: theme.dark ? '#F1F7FF' : theme.colors.primary,
  dayText: theme.colors.titleOnSoft,
  dayMarker: theme.dark ? '#86B4F3' : theme.colors.primary,
  dayMarkerSelected: theme.dark ? '#DCEBFF' : theme.colors.secondary,
  todayOutline: theme.colors.secondary,
  sectionTitle: theme.colors.titleOnSoft,
  sectionHint: theme.colors.textMuted,
  appointmentCardBackground: theme.dark ? '#121A23' : theme.colors.surface,
  appointmentCardBorder: theme.dark ? '#344455' : theme.colors.borderSoft,
});

export const getAppointmentClientLabel = (appointment: {
  quote: { client_name: string } | null;
  quote_id: string | null;
}): string => appointment.quote?.client_name ?? (appointment.quote_id ? '-' : 'Sin cliente');

export const getAppointmentDescription = (appointment: {
  title: string;
  notes: string | null;
  quote: { title: string; notes: string | null } | null;
}): string => {
  const description = appointment.notes?.trim() || appointment.quote?.notes?.trim() || appointment.quote?.title?.trim() || appointment.title.trim();
  return description || 'Sin descripcion';
};
