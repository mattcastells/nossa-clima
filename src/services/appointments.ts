import { supabase } from '@/lib/supabase';
import type { Appointment } from '@/types/db';

export type AppointmentInput = Omit<Appointment, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

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

export const deleteAppointment = async (appointmentId: string): Promise<void> => {
  const { error } = await supabase.from('appointments').delete().eq('id', appointmentId);
  if (error) throw error;
};
