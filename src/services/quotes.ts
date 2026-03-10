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

export const addQuoteMaterialItem = async (
  payload: Omit<QuoteMaterialItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'item_name_snapshot' | 'total_price'>,
): Promise<QuoteMaterialItem> => {
  const item = await getItemAndValidate(payload.item_id);

  const { data, error } = await supabase
    .from('quote_material_items')
    .insert({ ...payload, item_name_snapshot: item.name })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const addQuoteServiceItem = async (
  payload: Omit<QuoteServiceItem, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'service_name_snapshot' | 'total_price'>,
): Promise<QuoteServiceItem> => {
  const service = await getServiceAndValidate(payload.service_id);

  const { data, error } = await supabase
    .from('quote_service_items')
    .insert({ ...payload, service_name_snapshot: service.name })
    .select()
    .single();
  if (error) throw error;
  return data;
};
