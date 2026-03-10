export type ItemType = 'product' | 'tool' | 'material' | 'other';
export type PriceSourceType = 'purchase' | 'manual_update' | 'quote' | 'other';
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  sku: string | null;
  brand: string | null;
  item_type: ItemType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string | null;
  base_price: number;
  unit_type: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  user_id: string;
  client_name: string;
  client_phone: string | null;
  title: string;
  description: string | null;
  status: QuoteStatus;
  notes: string | null;
  subtotal_materials: number;
  subtotal_services: number;
  total: number;
  created_at: string;
  updated_at: string;
}

export interface QuoteMaterialItem {
  id: string;
  quote_id: string;
  user_id: string;
  item_id: string;
  item_name_snapshot: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  margin_percent: number | null;
  total_price: number;
  source_store_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteServiceItem {
  id: string;
  quote_id: string;
  user_id: string;
  service_id: string;
  service_name_snapshot: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoreItemPrice {
  id: string;
  user_id: string;
  store_id: string;
  item_id: string;
  price: number;
  currency: string;
  observed_at: string;
  source_type: PriceSourceType;
  quantity_reference: string | null;
  notes: string | null;
  created_at: string;
}

export interface LatestStoreItemPrice extends StoreItemPrice {
  store_name: string;
  item_name: string;
}
