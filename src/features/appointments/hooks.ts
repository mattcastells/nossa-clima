import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createAppointment,
  deleteAppointment,
  linkAppointmentToQuote,
  listAppointmentsInRange,
  type AppointmentInput,
  upsertQuoteAppointment,
} from '@/services/appointments';
import {
  cancelAppointmentReminder,
  scheduleAppointmentReminder,
} from '@/services/notifications';

const formatLocalDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMonthRange = (anchor: Date): { from: string; to: string } => {
  const fromDate = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const toDate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { from: formatLocalDate(fromDate), to: formatLocalDate(toDate) };
};

export const useAppointmentsInMonth = (anchor: Date) => {
  const range = getMonthRange(anchor);
  return useQuery({
    queryKey: ['appointments', 'month', range.from, range.to],
    queryFn: () => listAppointmentsInRange(range.from, range.to),
  });
};

export const useCreateAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AppointmentInput) => createAppointment(payload),
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      if (appointment.quote_id) {
        queryClient.invalidateQueries({ queryKey: ['quote-detail', appointment.quote_id] });
      }
      // Schedule a reminder if the appointment has a time set
      void scheduleAppointmentReminder({
        id: appointment.id,
        scheduled_for: appointment.scheduled_for,
        starts_at: appointment.starts_at,
        title: appointment.title,
        quote_id: appointment.quote_id ?? null,
      });
    },
  });
};

export const useDeleteAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) => deleteAppointment(appointmentId),
    onSuccess: (result, appointmentId) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      if (result.quote_id) {
        queryClient.invalidateQueries({ queryKey: ['quote-detail', result.quote_id] });
      }
      // Cancel the reminder for the deleted appointment
      void cancelAppointmentReminder(appointmentId);
    },
  });
};

export const useUpsertQuoteAppointment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<AppointmentInput, 'quote_id'> & { quote_id: string }) => upsertQuoteAppointment(payload),
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['quote-detail', appointment.quote_id] });
      // Reschedule reminder (cancels the previous one and schedules the new time)
      void scheduleAppointmentReminder({
        id: appointment.id,
        scheduled_for: appointment.scheduled_for,
        starts_at: appointment.starts_at,
        title: appointment.title,
        quote_id: appointment.quote_id ?? null,
      });
    },
  });
};

export const useLinkAppointmentToQuote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      appointmentId,
      quoteId,
      title,
      notes,
    }: {
      appointmentId: string;
      quoteId: string;
      title: string;
      notes?: string | null;
    }) => linkAppointmentToQuote({ appointmentId, quoteId, title, notes: notes ?? null }),
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      if (appointment.quote_id) {
        queryClient.invalidateQueries({ queryKey: ['quote-detail', appointment.quote_id] });
      }
    },
  });
};
