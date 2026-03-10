export type ItemType = 'product' | 'tool' | 'material' | 'other';
export type PriceSourceType = 'purchase' | 'manual_update' | 'quote' | 'other';

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
