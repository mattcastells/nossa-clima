import { supabase } from '@/lib/supabase';
import type { Appointment, Quote } from '@/types/db';
import { isMissingAppointmentQuoteLinkError } from './supabaseCompatibility';

export type AppointmentInput = Omit<Appointment, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type LinkAppointmentToQuoteInput = {
  appointmentId: string;
  quoteId: string;
  title: string;
  notes?: string | null;
};
export type AppointmentListItem = Appointment & {
  quote: Pick<Quote, 'id' | 'client_name' | 'title' | 'notes'> | null;
};

const missingQuoteIdColumnMessage = 'Falta aplicar la migracion 202603100004 para poder programar trabajos.';

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

  const { data: quotes, error: quotesError } = await supabase
    .from('quotes')
    .select('id, client_name, title, notes')
    .in('id', quoteIds);

  if (quotesError) throw quotesError;

  const quotesById = new Map((quotes ?? []).map((quote) => [quote.id, quote]));

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
