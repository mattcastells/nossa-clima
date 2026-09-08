export type ItemType = 'product' | 'tool' | 'material' | 'other';
export type PriceSourceType = 'purchase' | 'manual_update' | 'quote' | 'other' | 'scraper';

/**
 * Origen de una fila de catalogo.
 * `automated` solo si la creo el relevamiento de proveedores al aprobar un
 * candidato. Una tienda cargada a mano sigue siendo `manual` aunque el
 * relevamiento le haya completado el mail: eso se lee en `scraped_snapshot`.
 */
export type CatalogSourceType = 'manual' | 'automated';
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
  /** Sitio web. Lo completa el relevamiento si esta vacio; editable a mano. */
  website: string | null;
  email: string | null;
  /** Dominio registrable, clave de deduplicacion del relevamiento. */
  canonical_domain: string | null;
  notes: string | null;
  source: string;
  source_type: CatalogSourceType;
  source_url: string | null;
  last_scraped_at: string | null;
  /** Ultimos valores que escribio el relevamiento. Base del merge a tres vias. */
  scraped_snapshot: Record<string, string | null> | null;
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
  source: string;
  source_type: CatalogSourceType;
  source_url: string | null;
  last_scraped_at: string | null;
  scraped_snapshot: Record<string, string | null> | null;
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
  /** Resumen del trabajo. Se imprime en el informe bajo el titulo RESUMEN. */
  notes: string | null;
  /** Notas privadas del tecnico. Nunca se imprimen en el informe. */
  technician_notes: string | null;
  /** Datos de acceso del cliente (timbre, quien recibe). Se imprimen. */
  client_notes: string | null;
  /** Tecnico encargado. Se imprime en el bloque de cliente. */
  technician_name: string | null;
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
  margin_percent: number | null;
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
  /** URL de la que se leyo el precio, si vino del relevamiento. */
  source_url: string | null;
  /** Huella del hecho observado. Evita reinsertar la misma observacion. */
  external_ref: string | null;
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

export interface PdfFile {
  id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileDirectoryEntry {
  id: string;
  full_name: string | null;
}

// ---------------------------------------------------------------------------
// Relevamiento de proveedores (tools/supplier-survey)
// ---------------------------------------------------------------------------

export type SupplierCandidateDecision =
  | 'new'
  | 'update'
  | 'duplicate'
  | 'irrelevant'
  | 'needs_review'
  | 'applied'
  | 'discarded';

export interface SupplierSurveyRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed';
  mode: string;
  stats: Record<string, unknown>;
  config: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface SupplierSource {
  id: string;
  store_id: string | null;
  url: string;
  canonical_domain: string;
  discovery_method: 'seed' | 'search' | 'directory' | 'manual';
  status: 'active' | 'dead' | 'irrelevant' | 'blocked' | 'paused';
  robots_allowed: boolean | null;
  last_fetched_at: string | null;
  last_success_at: string | null;
  last_http_status: number | null;
  failure_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Empresa relevada, todavia fuera del catalogo. Nada de esto se ve en la app
 * hasta que alguien lo aprueba con `promote_supplier_candidate`.
 */
export interface SupplierCandidate {
  id: string;
  run_id: string | null;
  source_url: string;
  canonical_domain: string;
  fingerprint: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  categories: string[];
  relevance_score: number | null;
  match_store_id: string | null;
  match_confidence: number | null;
  match_reason: string | null;
  decision: SupplierCandidateDecision;
  diff: Record<string, { current: string | null; incoming: string | null }>;
  scraped_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** Fila de `supplier_review_queue`: lo unico que hay que mirar tras cada corrida. */
export interface SupplierReviewQueueEntry {
  id: string;
  run_id: string | null;
  decision: SupplierCandidateDecision;
  canonical_domain: string;
  source_url: string;
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  relevance_score: number | null;
  match_store_id: string | null;
  match_store_name: string | null;
  match_confidence: number | null;
  match_reason: string | null;
  diff: Record<string, { current: string | null; incoming: string | null }>;
  scraped_at: string;
}
