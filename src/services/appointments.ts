import { supabase } from '@/lib/supabase';
import type { Appointment } from '@/types/db';
import { isMissingAppointmentQuoteLinkError } from './supabaseCompatibility';

export type AppointmentInput = Omit<Appointment, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type LinkAppointmentToQuoteInput = {
  appointmentId: string;
  quoteId: string;
  title: string;
  notes?: string | null;
};

const missingQuoteIdColumnMessage = 'Falta aplicar la migracion 202603100004 para poder programar trabajos.';

export const listAppointmentsInRange = async (dateFrom: string, dateTo: string): Promise<Appointment[]> => {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .gte('scheduled_for', dateFrom)
    .lte('scheduled_for', dateTo)
    .order('scheduled_for')
    .order('starts_at');
  if (error) throw error;
  return data;
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
