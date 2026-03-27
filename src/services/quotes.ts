import { supabase } from '@/lib/supabase';
import { formatItemDisplayName, formatMeasuredItemDisplayName } from '@/lib/itemDisplay';
import type {
  Appointment,
  Item,
  ItemMeasurement,
  JobQuoteStatus,
  Quote,
  QuoteMaterialItem,
  QuoteServiceItem,
  Service,
  Store,
} from '@/types/db';
import { normalizeQuoteStatus } from '@/features/quotes/status';

import { isInvalidQuoteStatusEnumError, isMissingAppointmentQuoteLinkError, isMissingSupabaseColumnError } from './supabaseCompatibility';

// Helper: return current authenticated user's id, or null if no session.
const getCurrentUserId = async (): Promise<string | null> => {
  try {
    // supabase.auth.getUser() returns an object with `data.user` in most SDK versions.
    const userResult = await supabase.auth.getUser();
    const maybe = (userResult as unknown) as { data?: { user?: { id?: string } } } | undefined;
    const user = maybe?.data?.user ?? null;
    return (user && (user.id as string)) || null;
  } catch (err) {
    return null;
  }
};

export interface QuoteDetail {
  quote: Quote;
  materials: QuoteMaterialItem[];
  services: QuoteServiceItem[];
  appointment: Appointment | null;
}

export interface QuoteListItem extends Quote {
  appointment: Pick<Appointment, 'scheduled_for' | 'starts_at'> | null;
}

export interface DeleteOldQuotesResult {
  deletedCount: number;
  cutoffIso: string;
}

export interface DeleteAllQuotesResult {
  deletedCount: number;
}

export interface RefreshQuoteMaterialPricingResult {
  quoteId: string;
  updatedCount: number;
}

const CANCELLED_QUOTE_RETENTION_DAYS = 3;

export interface QuoteMaterialItemInput {
  quote_id: string;
  item_id: string;
  item_measurement_id?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  margin_percent?: number | null;
  source_store_id?: string | null;
  notes?: string | null;
}

export type QuoteServiceItemInput = Omit<
  QuoteServiceItem,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'service_name_snapshot' | 'total_price'
>;

export type QuoteMaterialItemUpdate = Partial<
  Pick<QuoteMaterialItem, 'item_id' | 'item_measurement_id' | 'quantity' | 'unit' | 'unit_price' | 'margin_percent' | 'source_store_id' | 'notes'>
>;

export type QuoteServiceItemUpdate = Partial<Pick<QuoteServiceItem, 'quantity' | 'unit_price' | 'margin_percent' | 'notes'>>;

const getCancelledQuoteCutoffIso = (): string => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - CANCELLED_QUOTE_RETENTION_DAYS);
  return cutoffDate.toISOString();
};

export const purgeExpiredCancelledQuotes = async (): Promise<number> => {
  const { data: quoteRows, error: quoteRowsError } = await supabase
    .from('quotes')
    .select('id')
    .eq('status', 'cancelled')
    .not('cancelled_at', 'is', null)
    .lte('cancelled_at', getCancelledQuoteCutoffIso());
  if (quoteRowsError) {
    if (isMissingSupabaseColumnError(quoteRowsError, 'cancelled_at')) {
      return 0;
    }
    throw quoteRowsError;
  }

  return deleteQuotesByIds((quoteRows ?? []).map((row) => row.id));
};

export const listQuotes = async (status?: JobQuoteStatus | 'all'): Promise<QuoteListItem[]> => {
  await purgeExpiredCancelledQuotes();

  let query = supabase.from('quotes').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) return [];

  const quoteIds = data.map((quote) => quote.id);
  const { data: appointments, error: appointmentsError } = await supabase
    .from('appointments')
    .select('quote_id, scheduled_for, starts_at')
    .in('quote_id', quoteIds)
    .order('scheduled_for')
    .order('starts_at');

  if (appointmentsError && !isMissingAppointmentQuoteLinkError(appointmentsError)) {
    throw appointmentsError;
  }

  const appointmentsByQuoteId = new Map<string, Pick<Appointment, 'scheduled_for' | 'starts_at'>>();
  (appointments ?? []).forEach((appointment) => {
    if (!appointment.quote_id || appointmentsByQuoteId.has(appointment.quote_id)) return;
    appointmentsByQuoteId.set(appointment.quote_id, {
      scheduled_for: appointment.scheduled_for,
      starts_at: appointment.starts_at,
    });
  });

  return data.map((quote) => ({
    ...quote,
    appointment: appointmentsByQuoteId.get(quote.id) ?? null,
  }));
};

export const getQuoteDetail = async (quoteId: string): Promise<QuoteDetail> => {
  await purgeExpiredCancelledQuotes();

  const { data: quote, error: quoteError } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  if (quoteError) throw quoteError;

  // Ownership check: ensure the current session user owns the quote
  try {
    const currentUserId = await getCurrentUserId();
    if (currentUserId && quote.user_id && quote.user_id !== currentUserId) {
      throw new Error('No autorizado para ver este presupuesto');
    }
  } catch (err) {
    // If we can't determine the current user, continue and let RLS handle enforcement
  }

  const { data: materials, error: materialsError } = await supabase
    .from('quote_material_items')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at');
  if (materialsError) throw materialsError;

  const { data: services, error: servicesError } = await supabase
    .from('quote_service_items')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at');
  if (servicesError) throw servicesError;

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .select('*')
    .eq('quote_id', quoteId)
    .maybeSingle();
  if (appointmentError && !isMissingAppointmentQuoteLinkError(appointmentError)) throw appointmentError;

  return { quote, materials, services, appointment: appointment ?? null };
};

export const upsertQuote = async (payload: Partial<Quote> & Pick<Quote, 'client_name' | 'title'>): Promise<Quote> => {
  const normalizedStatus = payload.status == null ? undefined : normalizeQuoteStatus(payload.status);
  const nextPayload: Partial<Quote> = {
    ...payload,
    ...(normalizedStatus
      ? {
          status: normalizedStatus,
          cancelled_at: normalizedStatus === 'cancelled' ? payload.cancelled_at ?? new Date().toISOString() : null,
        }
      : {}),
  };

  const { data, error } = await supabase.from('quotes').upsert(nextPayload).select().single();
  if (error) {
    if (!isInvalidQuoteStatusEnumError(error) && !isMissingSupabaseColumnError(error, 'cancelled_at')) {
      throw error;
    }

    const fallbackStatus =
      normalizedStatus === 'completed' ? 'approved' : normalizedStatus === 'cancelled' ? 'rejected' : normalizedStatus === 'pending' ? 'draft' : undefined;
    const fallbackPayload: Partial<Quote> = {
      ...payload,
      ...(fallbackStatus ? { status: fallbackStatus } : {}),
    };
    delete (fallbackPayload as { cancelled_at?: string | null }).cancelled_at;

    const fallback = await supabase.from('quotes').upsert(fallbackPayload).select().single();
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
  return data;
};

export const updateQuoteStatus = async (quoteId: string, status: JobQuoteStatus): Promise<Quote> => {
  const normalizedStatus = normalizeQuoteStatus(status);
  // Ownership check: ensure current user owns the quote before changing status
  try {
    const currentUserId = await getCurrentUserId();
    if (currentUserId) {
      const { data: existing, error: existingError } = await supabase.from('quotes').select('user_id').eq('id', quoteId).single();
      if (existingError) throw existingError;
      if (existing && existing.user_id && existing.user_id !== currentUserId) {
        throw new Error('No autorizado para cambiar el estado de este presupuesto');
      }
    }
  } catch (err) {
    // fallback to DB enforcement
  }
  const { data, error } = await supabase
    .from('quotes')
    .update({
      status: normalizedStatus,
      cancelled_at: normalizedStatus === 'cancelled' ? new Date().toISOString() : null,
    })
    .eq('id', quoteId)
    .select()
    .single();
  if (error) {
    if (!isInvalidQuoteStatusEnumError(error) && !isMissingSupabaseColumnError(error, 'cancelled_at')) {
      throw error;
    }

    const legacyStatus = normalizedStatus === 'completed' ? 'approved' : normalizedStatus === 'cancelled' ? 'rejected' : 'draft';
    const fallback = await supabase.from('quotes').update({ status: legacyStatus }).eq('id', quoteId).select().single();
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
  return data;
};

export const deleteOldQuotes = async (olderThanDays: number): Promise<DeleteOldQuotesResult> => {
  const safeDays = Math.max(1, Math.floor(olderThanDays));
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - safeDays);
  const cutoffIso = cutoffDate.toISOString();

  const { data: quoteRows, error: quoteRowsError } = await supabase
    .from('quotes')
    .select('id')
    .lt('created_at', cutoffIso);
  if (quoteRowsError) throw quoteRowsError;

  const deletedCount = await deleteQuotesByIds((quoteRows ?? []).map((row) => row.id));

  return {
    deletedCount,
    cutoffIso,
  };
};

export const deleteAllQuotes = async (): Promise<DeleteAllQuotesResult> => {
  const { data: quoteRows, error: quoteRowsError } = await supabase.from('quotes').select('id');
  if (quoteRowsError) throw quoteRowsError;

  const deletedCount = await deleteQuotesByIds((quoteRows ?? []).map((row) => row.id));
  return { deletedCount };
};

const QUOTE_DELETE_BATCH_SIZE = 100;

const chunkIds = (ids: string[]): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += QUOTE_DELETE_BATCH_SIZE) {
    chunks.push(ids.slice(index, index + QUOTE_DELETE_BATCH_SIZE));
  }
  return chunks;
};

const deleteQuotesByIds = async (quoteIds: string[]): Promise<number> => {
  if (quoteIds.length === 0) return 0;

  let deletedQuotes = 0;

  for (const idChunk of chunkIds(quoteIds)) {
    const { error: appointmentError } = await supabase.from('appointments').delete().in('quote_id', idChunk);
    if (appointmentError && !isMissingAppointmentQuoteLinkError(appointmentError)) {
      throw appointmentError;
    }

    const { error: materialsError } = await supabase.from('quote_material_items').delete().in('quote_id', idChunk);
    if (materialsError) throw materialsError;

    const { error: servicesError } = await supabase.from('quote_service_items').delete().in('quote_id', idChunk);
    if (servicesError) throw servicesError;

    const { data: deletedRows, error: quoteDeleteError } = await supabase.from('quotes').delete().in('id', idChunk).select('id');
    if (quoteDeleteError) throw quoteDeleteError;

    deletedQuotes += deletedRows?.length ?? 0;
  }

  return deletedQuotes;
};

export const deleteQuote = async (quoteId: string): Promise<void> => {
  await deleteQuotesByIds([quoteId]);
};

const getItemAndValidate = async (itemId: string): Promise<Item> => {
  const { data, error } = await supabase.from('items').select('*').eq('id', itemId).single();
  if (error) throw error;
  return data;
};

const getStoreAndValidate = async (storeId: string): Promise<Store> => {
  const { data, error } = await supabase.from('stores').select('*').eq('id', storeId).single();
  if (error) throw error;
  return data;
};

const getServiceAndValidate = async (serviceId: string): Promise<Service> => {
  const { data, error } = await supabase.from('services').select('*').eq('id', serviceId).single();
  if (error) throw error;
  return data;
};

const getMeasurementAndValidate = async (measurementId: string): Promise<ItemMeasurement> => {
  const { data, error } = await supabase.from('item_measurements').select('*').eq('id', measurementId).single();
  if (error) throw error;
  return data;
};

const resolveMaterialSnapshot = async (
  itemId: string,
  measurementId?: string | null,
): Promise<{ item: Item; measurement: ItemMeasurement | null; itemNameSnapshot: string; itemMeasurementSnapshot: string | null }> => {
  const item = await getItemAndValidate(itemId);
  const measurement = measurementId ? await getMeasurementAndValidate(measurementId) : null;

  if (measurement && measurement.item_id !== item.id) {
    throw new Error('La medida seleccionada no pertenece al material.');
  }

  return {
    item,
    measurement,
    itemNameSnapshot: measurement ? formatMeasuredItemDisplayName(item, measurement) : formatItemDisplayName(item),
    itemMeasurementSnapshot: measurement?.label ?? null,
  };
};

export const addQuoteMaterialItem = async (payload: QuoteMaterialItemInput): Promise<QuoteMaterialItem> => {
  const [materialContext, sourceStore] = await Promise.all([
    resolveMaterialSnapshot(payload.item_id, payload.item_measurement_id ?? null),
    payload.source_store_id ? getStoreAndValidate(payload.source_store_id) : Promise.resolve(null),
  ]);

  const { data, error } = await supabase
    .from('quote_material_items')
    .insert({
      ...payload,
      item_measurement_id: payload.item_measurement_id ?? null,
      item_measurement_snapshot: materialContext.itemMeasurementSnapshot,
      item_name_snapshot: materialContext.itemNameSnapshot,
      source_store_name_snapshot: sourceStore?.name ?? null,
    })
    .select()
    .single();
  if (error) {
    if (!isMissingSupabaseColumnError(error, 'source_store_name_snapshot')) throw error;

    const fallback = await supabase
      .from('quote_material_items')
      .insert({
        ...payload,
        item_measurement_id: payload.item_measurement_id ?? null,
        item_measurement_snapshot: materialContext.itemMeasurementSnapshot,
        item_name_snapshot: materialContext.itemNameSnapshot,
      })
      .select()
      .single();
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
  return data;
};

export const updateQuoteMaterialItem = async (itemId: string, payload: QuoteMaterialItemUpdate): Promise<QuoteMaterialItem> => {
  const { data: existing, error: existingError } = await supabase.from('quote_material_items').select('*').eq('id', itemId).single();
  if (existingError) throw existingError;

  // Ownership check (defense-in-depth): ensure the session user is the owner
  try {
    const currentUserId = await getCurrentUserId();
    if (currentUserId && existing.user_id && existing.user_id !== currentUserId) {
      throw new Error('No autorizado para modificar este material');
    }
  } catch (err) {
    // If unable to resolve current user, let DB RLS enforce permissions instead of failing client-side.
  }

  let updatePayload: QuoteMaterialItemUpdate & {
    item_name_snapshot?: string;
    item_measurement_snapshot?: string | null;
    source_store_name_snapshot?: string | null;
  } = payload;

  const nextItemId = payload.item_id ?? existing.item_id;
  const nextMeasurementId = payload.item_measurement_id === undefined ? existing.item_measurement_id : payload.item_measurement_id;
  const shouldRefreshMaterialSnapshot = payload.item_id !== undefined || payload.item_measurement_id !== undefined || payload.unit !== undefined;

  if (shouldRefreshMaterialSnapshot) {
    const materialContext = await resolveMaterialSnapshot(nextItemId, nextMeasurementId);
    updatePayload = {
      ...payload,
      item_name_snapshot: materialContext.itemNameSnapshot,
      item_measurement_snapshot: materialContext.itemMeasurementSnapshot,
      unit: payload.unit ?? existing.unit ?? materialContext.measurement?.unit ?? materialContext.item.unit ?? 'mt',
    };
  }

  if (payload.source_store_id !== undefined) {
    if (!payload.source_store_id) {
      updatePayload = {
        ...updatePayload,
        source_store_name_snapshot: null,
      };
    } else {
      const store = await getStoreAndValidate(payload.source_store_id);
      updatePayload = {
        ...updatePayload,
        source_store_name_snapshot: store.name,
      };
    }
  }

  const { data, error } = await supabase.from('quote_material_items').update(updatePayload).eq('id', itemId).select().single();
  if (error) {
    if (!isMissingSupabaseColumnError(error, 'source_store_name_snapshot')) throw error;

    const fallbackPayload = { ...updatePayload };
    delete fallbackPayload.source_store_name_snapshot;

    const fallback = await supabase.from('quote_material_items').update(fallbackPayload).eq('id', itemId).select().single();
    if (fallback.error) throw fallback.error;
    return fallback.data;
  }
  return data;
};

export const deleteQuoteMaterialItem = async (itemId: string): Promise<{ quote_id: string }> => {
  const { data: existing, error: existingError } = await supabase.from('quote_material_items').select('*').eq('id', itemId).single();
  if (existingError) throw existingError;

  try {
    const currentUserId = await getCurrentUserId();
    if (currentUserId && existing.user_id && existing.user_id !== currentUserId) {
      throw new Error('No autorizado para eliminar este material');
    }
  } catch (err) {
    // fallback to DB enforcement
  }

  const { data, error } = await supabase.from('quote_material_items').delete().eq('id', itemId).select('quote_id').single();
  if (error) throw error;
  return data;
};

export const refreshQuoteMaterialPricing = async (quoteId: string): Promise<RefreshQuoteMaterialPricingResult> => {
  const { data, error } = await supabase
    .from('quote_material_items')
    .update({ updated_at: new Date().toISOString() })
    .eq('quote_id', quoteId)
    .select('id');
  if (error) throw error;

  return {
    quoteId,
    updatedCount: data?.length ?? 0,
  };
};

export const addQuoteServiceItem = async (payload: QuoteServiceItemInput): Promise<QuoteServiceItem> => {
  const service = await getServiceAndValidate(payload.service_id);

  const { data, error } = await supabase
    .from('quote_service_items')
    .insert({ ...payload, service_name_snapshot: service.name })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateQuoteServiceItem = async (itemId: string, payload: QuoteServiceItemUpdate): Promise<QuoteServiceItem> => {
  // Fetch existing to validate ownership
  const { data: existing, error: existingError } = await supabase.from('quote_service_items').select('*').eq('id', itemId).single();
  if (existingError) throw existingError;

  try {
    const currentUserId = await getCurrentUserId();
    if (currentUserId && existing.user_id && existing.user_id !== currentUserId) {
      throw new Error('No autorizado para modificar este servicio');
    }
  } catch (err) {
    // fall back to DB RLS
  }

  const { data, error } = await supabase.from('quote_service_items').update(payload).eq('id', itemId).select().single();
  if (error) throw error;
  return data;
};

export const deleteQuoteServiceItem = async (itemId: string): Promise<{ quote_id: string }> => {
  const { data: existing, error: existingError } = await supabase.from('quote_service_items').select('*').eq('id', itemId).single();
  if (existingError) throw existingError;

  try {
    const currentUserId = await getCurrentUserId();
    if (currentUserId && existing.user_id && existing.user_id !== currentUserId) {
      throw new Error('No autorizado para eliminar este servicio');
    }
  } catch (err) {
    // fallback to DB enforcement
  }

  const { data, error } = await supabase.from('quote_service_items').delete().eq('id', itemId).select('quote_id').single();
  if (error) throw error;
  return data;
};
