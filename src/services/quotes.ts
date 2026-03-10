import { supabase } from '@/lib/supabase';
import type { Item, Quote, QuoteMaterialItem, QuoteServiceItem, QuoteStatus, Service, StoreItemPrice } from '@/types/db';

export interface QuoteDetail {
  quote: Quote;
  materials: QuoteMaterialItem[];
  services: QuoteServiceItem[];
}

export interface SuggestedMaterialPrice {
  baseCost: number;
  suggestedUnitPrice: number;
}

export type QuoteMaterialItemInput = Omit<
  QuoteMaterialItem,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'item_name_snapshot' | 'total_price'
>;

export type QuoteServiceItemInput = Omit<
  QuoteServiceItem,
  'id' | 'user_id' | 'created_at' | 'updated_at' | 'service_name_snapshot' | 'total_price'
>;

export type QuoteMaterialItemUpdate = Partial<Pick<QuoteMaterialItem, 'quantity' | 'unit_price' | 'margin_percent' | 'source_store_id' | 'notes'>>;

export type QuoteServiceItemUpdate = Partial<Pick<QuoteServiceItem, 'quantity' | 'unit_price' | 'notes'>>;

export const listQuotes = async (status?: QuoteStatus | 'all'): Promise<Quote[]> => {
  let query = supabase.from('quotes').select('*').order('created_at', { ascending: false });
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const getQuoteDetail = async (quoteId: string): Promise<QuoteDetail> => {
  const { data: quote, error: quoteError } = await supabase.from('quotes').select('*').eq('id', quoteId).single();
  if (quoteError) throw quoteError;

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

  return { quote, materials, services };
};

export const upsertQuote = async (payload: Partial<Quote> & Pick<Quote, 'client_name' | 'title'>): Promise<Quote> => {
  const { data, error } = await supabase.from('quotes').upsert(payload).select().single();
  if (error) throw error;
  return data;
};

const getItemAndValidate = async (itemId: string): Promise<Item> => {
  const { data, error } = await supabase.from('items').select('*').eq('id', itemId).single();
  if (error) throw error;
  if (!data.is_active) throw new Error('No se puede agregar un ítem archivado.');
  return data;
};

const getServiceAndValidate = async (serviceId: string): Promise<Service> => {
  const { data, error } = await supabase.from('services').select('*').eq('id', serviceId).single();
  if (error) throw error;
  if (!data.is_active) throw new Error('No se puede agregar un servicio archivado.');
  return data;
};

export const getSuggestedMaterialPrice = async (
  itemId: string,
  marginPercent?: number | null,
  sourceStoreId?: string | null,
): Promise<SuggestedMaterialPrice> => {
  let record: Pick<StoreItemPrice, 'price'> | null = null;

  if (sourceStoreId) {
    const byStore = await supabase
      .from('latest_store_item_prices')
      .select('price')
      .eq('item_id', itemId)
      .eq('store_id', sourceStoreId)
      .maybeSingle();
    if (byStore.error) throw byStore.error;
    record = byStore.data;
  }

  if (!record) {
    const latest = await supabase
      .from('store_item_prices')
      .select('price')
      .eq('item_id', itemId)
      .order('observed_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.error) throw latest.error;
    record = latest.data;
  }

  const baseCost = Number(record?.price ?? 0);
  const suggestedUnitPrice = marginPercent != null ? Number((baseCost * (1 + marginPercent / 100)).toFixed(2)) : baseCost;

  return { baseCost, suggestedUnitPrice };
};

export const addQuoteMaterialItem = async (payload: QuoteMaterialItemInput): Promise<QuoteMaterialItem> => {
  const item = await getItemAndValidate(payload.item_id);

  const { data, error } = await supabase
    .from('quote_material_items')
    .insert({ ...payload, item_name_snapshot: item.name })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateQuoteMaterialItem = async (itemId: string, payload: QuoteMaterialItemUpdate): Promise<QuoteMaterialItem> => {
  const { data, error } = await supabase.from('quote_material_items').update(payload).eq('id', itemId).select().single();
  if (error) throw error;
  return data;
};

export const deleteQuoteMaterialItem = async (itemId: string): Promise<{ quote_id: string }> => {
  const { data, error } = await supabase.from('quote_material_items').delete().eq('id', itemId).select('quote_id').single();
  if (error) throw error;
  return data;
};

export const duplicateQuoteMaterialItem = async (itemId: string): Promise<QuoteMaterialItem> => {
  const { data: existing, error: existingError } = await supabase.from('quote_material_items').select('*').eq('id', itemId).single();
  if (existingError) throw existingError;

  const payload: QuoteMaterialItemInput = {
    quote_id: existing.quote_id,
    item_id: existing.item_id,
    quantity: existing.quantity,
    unit: existing.unit,
    unit_price: existing.unit_price,
    margin_percent: existing.margin_percent,
    source_store_id: existing.source_store_id,
    notes: existing.notes,
  };

  return addQuoteMaterialItem(payload);
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
  const { data, error } = await supabase.from('quote_service_items').update(payload).eq('id', itemId).select().single();
  if (error) throw error;
  return data;
};

export const deleteQuoteServiceItem = async (itemId: string): Promise<{ quote_id: string }> => {
  const { data, error } = await supabase.from('quote_service_items').delete().eq('id', itemId).select('quote_id').single();
  if (error) throw error;
  return data;
};

export const duplicateQuoteServiceItem = async (itemId: string): Promise<QuoteServiceItem> => {
  const { data: existing, error: existingError } = await supabase.from('quote_service_items').select('*').eq('id', itemId).single();
  if (existingError) throw existingError;

  const payload: QuoteServiceItemInput = {
    quote_id: existing.quote_id,
    service_id: existing.service_id,
    quantity: existing.quantity,
    unit_price: existing.unit_price,
    notes: existing.notes,
  };

  return addQuoteServiceItem(payload);
};
