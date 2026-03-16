export type ItemType = 'product' | 'tool' | 'material' | 'other';
export type PriceSourceType = 'purchase' | 'manual_update' | 'quote' | 'other';
export type MeasurePricingMode = 'manual' | 'calculated';
export type LegacyQuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected';
export type JobQuoteStatus = 'pending' | 'completed' | 'cancelled';
export type QuoteStatus = LegacyQuoteStatus | JobQuoteStatus;
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  notes: string | null;
  archived_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  notes: string | null;
  category: string | null;
  base_price_label: string | null;
  variant_label: string | null;
  presentation_quantity: number | null;
  presentation_unit: string | null;
  unit: string | null;
  sku: string | null;
  brand: string | null;
  item_type: ItemType;
  archived_at: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemMeasurement {
  id: string;
  item_id: string;
  user_id: string | null;
  label: string;
  unit: string;
  pricing_mode: MeasurePricingMode;
  grams_per_meter: number | null;
  notes: string | null;
  sort_order: number;
  archived_at: string | null;
  updated_by: string | null;
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
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceCategory {
  id: string;
  user_id: string;
  name: string;
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
  default_material_margin_percent: number | null;
  cancelled_at: string | null;
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
  item_measurement_id: string | null;
  item_measurement_snapshot: string | null;
  item_name_snapshot: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  margin_percent: number | null;
  total_price: number;
  source_store_id: string | null;
  source_store_name_snapshot: string | null;
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
  user_id: string | null;
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

export interface StoreItemMeasurementPrice {
  id: string;
  user_id: string | null;
  store_id: string;
  item_measurement_id: string;
  price: number;
  currency: string;
  observed_at: string;
  source_type: PriceSourceType;
  notes: string | null;
  created_at: string;
}

export interface LatestStoreItemPrice extends StoreItemPrice {
  store_name: string;
  item_name: string;
  item_category?: string | null;
  base_price_label?: string | null;
  item_variant_label?: string | null;
  item_presentation_quantity?: number | null;
  item_presentation_unit?: string | null;
  item_unit?: string | null;
}

export interface LatestStoreItemMeasurementPrice {
  id: string;
  user_id: string | null;
  store_id: string;
  store_name: string;
  item_id: string;
  item_name: string;
  item_category: string | null;
  base_price_label: string | null;
  item_measurement_id: string;
  item_measurement_label: string;
  measurement_unit: string;
  pricing_mode: MeasurePricingMode;
  grams_per_meter: number | null;
  price: number;
  base_price: number | null;
  currency: string;
  observed_at: string;
  source_type: PriceSourceType;
  notes: string | null;
  created_at: string;
  price_origin: 'manual' | 'calculated';
}

export interface Appointment {
  id: string;
  user_id: string;
  quote_id: string | null;
  title: string;
  notes: string | null;
  scheduled_for: string;
  starts_at: string | null;
  ends_at: string | null;
  status: AppointmentStatus;
  store_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileDirectoryEntry {
  id: string;
  full_name: string | null;
}
