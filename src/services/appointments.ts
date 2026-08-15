import { supabase } from '@/lib/supabase';
import type { Appointment, Quote } from '@/types/db';
import { isMissingAppointmentQuoteLinkError, isMissingSupabaseColumnError } from './supabaseCompatibility';

export type AppointmentInput = Omit<Appointment, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type LinkAppointmentToQuoteInput = {
  appointmentId: string;
  quoteId: string;
  title: string;
  notes?: string | null;
};
export type AppointmentListItem = Appointment & {
  quote: Pick<Quote, 'id' | 'client_name' | 'title' | 'notes' | 'status'> & {
    // Puede faltar si todavia no se aplico la migracion 202608150001.
    technician_notes?: string | null;
  } | null;
};

const missingQuoteIdColumnMessage = 'Falta aplicar la migracion 202603100004 para poder programar trabajos.';

/**
 * Trae los trabajos de un lote de turnos. Pide technician_notes (para mostrarlo
 * en la agenda) pero reintenta sin esa columna si todavia no se aplico la
 * migracion 202608150001: un select con columna inexistente falla entero.
 */
const fetchQuotesForAppointments = async (
  quoteIds: string[],
): Promise<NonNullable<AppointmentListItem['quote']>[]> => {
  const withTechnicianNotes = await supabase
    .from('quotes')
    .select('id, client_name, title, notes, technician_notes, status')
    .in('id', quoteIds);

  if (!withTechnicianNotes.error) return withTechnicianNotes.data ?? [];
  if (!isMissingSupabaseColumnError(withTechnicianNotes.error, 'technician_notes')) {
    throw withTechnicianNotes.error;
  }

  const fallback = await supabase.from('quotes').select('id, client_name, title, notes, status').in('id', quoteIds);
  if (fallback.error) throw fallback.error;
  return fallback.data ?? [];
};

export const listAppointmentsInRange = async (dateFrom: string, dateTo: string): Promise<AppointmentListItem[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .gte('scheduled_for', dateFrom)
    .lte('scheduled_for', dateTo)
    .order('scheduled_for')
    .order('starts_at');
  if (error) throw error;
  if (!data?.length) return [];

  const quoteIds = Array.from(new Set(data.map((appointment) => appointment.quote_id).filter(Boolean))) as string[];

  if (quoteIds.length === 0) {
    return data.map((appointment) => ({ ...appointment, quote: null }));
  }

  const quotes = await fetchQuotesForAppointments(quoteIds);
  const quotesById = new Map(quotes.map((quote) => [quote.id, quote]));

  return data.map((appointment) => ({
    ...appointment,
    quote: appointment.quote_id ? quotesById.get(appointment.quote_id) ?? null : null,
  }));
};

export const createAppointment = async (payload: AppointmentInput): Promise<Appointment> => {
  const { data, error } = await supabase.from('appointments').insert(payload).select().single();
  if (error) throw error;
  return data;
};

export const deleteAppointment = async (appointmentId: string): Promise<{ quote_id: string | null }> => {
  const { data, error } = await supabase.from('appointments').delete().eq('id', appointmentId).select('quote_id').single();
  if (error) throw error;
  return data;
};

export const upsertQuoteAppointment = async (
  payload: Omit<AppointmentInput, 'quote_id'> & { quote_id: string },
): Promise<Appointment> => {
  const normalizedPayload = {
    ...payload,
    quote_id: payload.quote_id,
    notes: payload.notes ?? null,
    starts_at: payload.starts_at ?? null,
    ends_at: payload.ends_at ?? null,
    store_id: payload.store_id ?? null,
  };

  const { data: existing, error: existingError } = await supabase
    .from('appointments')
    .select('id')
    .eq('quote_id', payload.quote_id)
    .maybeSingle();

  if (existingError) {
    if (isMissingAppointmentQuoteLinkError(existingError)) {
      throw new Error(missingQuoteIdColumnMessage);
    }
    throw existingError;
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('appointments')
      .update(normalizedPayload)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      if (isMissingAppointmentQuoteLinkError(error)) {
        throw new Error(missingQuoteIdColumnMessage);
      }
      throw error;
    }
    return data;
  }

  const { data, error } = await supabase.from('appointments').insert(normalizedPayload).select().single();
  if (error) {
    if (isMissingAppointmentQuoteLinkError(error)) {
      throw new Error(missingQuoteIdColumnMessage);
    }
    throw error;
  }
  return data;
};

/**
 * Lists all upcoming appointments (from today onwards) that have a time set.
 * Used to sync local notifications when the app opens.
 */
export const listUpcomingAppointments = async (): Promise<Appointment[]> => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const dateFrom = `${yyyy}-${mm}-${dd}`;

  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .gte('scheduled_for', dateFrom)
    .not('starts_at', 'is', null)
    .order('scheduled_for')
    .order('starts_at');

  if (error) throw error;
  return data ?? [];
};

export const linkAppointmentToQuote = async ({
  appointmentId,
  quoteId,
  title,
  notes,
}: LinkAppointmentToQuoteInput): Promise<Appointment> => {
  const { data, error } = await supabase
    .from('appointments')
    .update({
      quote_id: quoteId,
      title,
      notes: notes ?? null,
    })
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) {
    if (isMissingAppointmentQuoteLinkError(error)) {
      throw new Error(missingQuoteIdColumnMessage);
    }
    throw error;
  }

  return data;
};

export const setAppointmentScheduledNotificationId = async (
  appointmentId: string,
  scheduledNotificationId: string | null,
): Promise<void> => {
  const { error } = await supabase
    .from('appointments')
    .update({ scheduled_notification_id: scheduledNotificationId })
    .eq('id', appointmentId);

  if (error) throw error;
};

export const getAppointmentById = async (appointmentId: string): Promise<Appointment | null> => {
  const { data, error } = await supabase.from('appointments').select('*').eq('id', appointmentId).maybeSingle();
  if (error) throw error;
  return data ?? null;
};
