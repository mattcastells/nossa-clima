import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createAppointment,
  deleteAppointment,
  linkAppointmentToQuote,
  listAppointmentsInRange,
  type AppointmentListItem,
  type AppointmentInput,
  upsertQuoteAppointment,
} from '@/services/appointments';
import {
  cancelAppointmentReminder,
  scheduleAppointmentReminder,
} from '@/services/notifications';
import type { QuoteDetail, QuoteListItem } from '@/services/quotes';
import type { Appointment, Quote } from '@/types/db';

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

const toQuoteSummary = (quote: Pick<Quote, 'id' | 'client_name' | 'title' | 'notes' | 'status'>): AppointmentListItem['quote'] => ({
  id: quote.id,
  client_name: quote.client_name,
  title: quote.title,
  notes: quote.notes,
  status: quote.status,
});

const getQuoteSummaryFromCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  quoteId: string | null,
): AppointmentListItem['quote'] => {
  if (!quoteId) return null;

  const detail = queryClient.getQueryData<QuoteDetail>(['quote-detail', quoteId]);
  if (detail) {
    return toQuoteSummary(detail.quote);
  }

  const listCaches = queryClient.getQueriesData<QuoteListItem[]>({ queryKey: ['quotes'] });
  for (const [, quotes] of listCaches) {
    const found = quotes?.find((quote) => quote.id === quoteId);
    if (found) {
      return toQuoteSummary(found);
    }
  }

  return null;
};

const sortAppointments = (appointments: AppointmentListItem[]): AppointmentListItem[] =>
  appointments
    .slice()
    .sort(
      (left, right) =>
        left.scheduled_for.localeCompare(right.scheduled_for) ||
        (left.starts_at ?? '').localeCompare(right.starts_at ?? '') ||
        left.id.localeCompare(right.id),
    );

const isAppointmentInRange = (appointment: Pick<Appointment, 'scheduled_for'>, from: string, to: string): boolean =>
  appointment.scheduled_for >= from && appointment.scheduled_for <= to;

const updateMonthAppointmentCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (appointments: AppointmentListItem[], from: string, to: string) => AppointmentListItem[],
) => {
  queryClient.getQueriesData<AppointmentListItem[]>({ queryKey: ['appointments', 'month'] }).forEach(([queryKey, appointments]) => {
    if (!appointments) return;
    const from = typeof queryKey[2] === 'string' ? queryKey[2] : '';
    const to = typeof queryKey[3] === 'string' ? queryKey[3] : '';
    queryClient.setQueryData<AppointmentListItem[]>(queryKey, updater(appointments, from, to));
  });
};

const upsertAppointmentInMonthCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  appointment: Appointment,
  quote: AppointmentListItem['quote'],
) => {
  updateMonthAppointmentCaches(queryClient, (appointments, from, to) => {
    const existing = appointments.find((item) => item.id === appointment.id);
    const inRange = isAppointmentInRange(appointment, from, to);

    if (!inRange) {
      return existing ? appointments.filter((item) => item.id !== appointment.id) : appointments;
    }

    const nextItem: AppointmentListItem = {
      ...appointment,
      quote: appointment.quote_id ? quote ?? existing?.quote ?? null : null,
    };

    return sortAppointments(
      existing
        ? appointments.map((item) => (item.id === appointment.id ? nextItem : item))
        : [...appointments, nextItem],
    );
  });
};

const removeAppointmentFromMonthCaches = (
  queryClient: ReturnType<typeof useQueryClient>,
  appointmentId: string,
) => {
  updateMonthAppointmentCaches(queryClient, (appointments) => appointments.filter((item) => item.id !== appointmentId));
};

const setQuoteDetailAppointment = (
  queryClient: ReturnType<typeof useQueryClient>,
  quoteId: string,
  appointment: Appointment | null,
) => {
  const detail = queryClient.getQueryData<QuoteDetail>(['quote-detail', quoteId]);
  if (!detail) return;

  queryClient.setQueryData<QuoteDetail>(['quote-detail', quoteId], {
    ...detail,
    appointment,
  });
};

const setQuoteListAppointment = (
  queryClient: ReturnType<typeof useQueryClient>,
  quoteId: string,
  appointment: Pick<Appointment, 'scheduled_for' | 'starts_at'> | null,
) => {
  queryClient.getQueriesData<QuoteListItem[]>({ queryKey: ['quotes'] }).forEach(([queryKey, quotes]) => {
    if (!quotes) return;
    queryClient.setQueryData<QuoteListItem[]>(
      queryKey,
      quotes.map((quote) => (quote.id === quoteId ? { ...quote, appointment } : quote)),
    );
  });
};

const invalidateAppointmentCaches = (queryClient: ReturnType<typeof useQueryClient>, quoteId?: string | null) => {
  void queryClient.invalidateQueries({ queryKey: ['appointments'], refetchType: 'inactive' });
  if (quoteId) {
    void queryClient.invalidateQueries({ queryKey: ['quote-detail', quoteId], exact: true, refetchType: 'inactive' });
    void queryClient.invalidateQueries({ queryKey: ['quotes'], refetchType: 'inactive' });
  }
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
      const quote = getQuoteSummaryFromCaches(queryClient, appointment.quote_id);
      upsertAppointmentInMonthCaches(queryClient, appointment, quote);
      if (appointment.quote_id) {
        setQuoteDetailAppointment(queryClient, appointment.quote_id, appointment);
        setQuoteListAppointment(queryClient, appointment.quote_id, {
          scheduled_for: appointment.scheduled_for,
          starts_at: appointment.starts_at,
        });
      }
      invalidateAppointmentCaches(queryClient, appointment.quote_id);
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
      removeAppointmentFromMonthCaches(queryClient, appointmentId);
      if (result.quote_id) {
        setQuoteDetailAppointment(queryClient, result.quote_id, null);
        setQuoteListAppointment(queryClient, result.quote_id, null);
      }
      invalidateAppointmentCaches(queryClient, result.quote_id);
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
      const quote = getQuoteSummaryFromCaches(queryClient, appointment.quote_id);
      upsertAppointmentInMonthCaches(queryClient, appointment, quote);
      if (appointment.quote_id) {
        setQuoteDetailAppointment(queryClient, appointment.quote_id, appointment);
        setQuoteListAppointment(queryClient, appointment.quote_id, {
          scheduled_for: appointment.scheduled_for,
          starts_at: appointment.starts_at,
        });
      }
      invalidateAppointmentCaches(queryClient, appointment.quote_id);
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
      const quote = getQuoteSummaryFromCaches(queryClient, appointment.quote_id);
      upsertAppointmentInMonthCaches(queryClient, appointment, quote);
      if (appointment.quote_id) {
        setQuoteDetailAppointment(queryClient, appointment.quote_id, appointment);
        setQuoteListAppointment(queryClient, appointment.quote_id, {
          scheduled_for: appointment.scheduled_for,
          starts_at: appointment.starts_at,
        });
      }
      invalidateAppointmentCaches(queryClient, appointment.quote_id);
    },
  });
};
