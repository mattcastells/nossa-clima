/**
 * Tipos del dominio del relevamiento.
 *
 * Regla que atraviesa todo el pipeline: ningun dato viaja "pelado". Cada campo
 * extraido de un sitio viaja como `Field<T>`, con la URL de donde salio, la
 * estrategia que lo saco y cuanta confianza le tenemos. Sin eso no hay
 * trazabilidad ni forma de resolver conflictos entre estrategias.
 */

/** De donde salio un dato y cuanto le creemos. */
export interface Provenance {
  /** URL exacta de la que se extrajo (puede no ser la home del sitio). */
  sourceUrl: string;
  /** Estrategia de extraccion responsable, ej. 'json-ld', 'meta-tags'. */
  strategy: string;
  /** 0..1. Ver CONFIDENCE en extract/registry.ts. */
  confidence: number;
  /** Momento del relevamiento, ISO 8601. */
  observedAt: string;
}

export interface Field<T> {
  value: T;
  provenance: Provenance;
}

export const field = <T>(value: T, provenance: Provenance): Field<T> => ({ value, provenance });

/** Empresa tal como sale del sitio, antes de normalizar. */
export interface RawCompany {
  name?: Field<string>;
  legalName?: Field<string>;
  description?: Field<string>;
  address?: Field<string>;
  phone?: Field<string>;
  email?: Field<string>;
  website?: Field<string>;
  categories?: Field<string[]>;
}

/** Producto tal como sale del sitio, antes de normalizar. */
export interface RawProduct {
  name: Field<string>;
  brand?: Field<string>;
  sku?: Field<string>;
  category?: Field<string>;
  price?: Field<number>;
  currency?: Field<string>;
  availability?: Field<string>;
  unit?: Field<string>;
}

/** Empresa normalizada: valores limpios, listos para comparar y persistir. */
export interface NormalizedCompany {
  name: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  canonicalDomain: string;
  categories: string[];
  /** Huella de deduplicacion. Ver dedupe/fingerprint. */
  fingerprint: string;
  relevanceScore: number;
  sourceUrl: string;
  scrapedAt: string;
  /** Procedencia por campo, para el reporte y la auditoria. */
  provenance: Record<string, Provenance>;
  raw: Record<string, unknown>;
}

export interface NormalizedProduct {
  name: string;
  brand: string | null;
  sku: string | null;
  category: string | null;
  unit: string | null;
  presentationQuantity: number | null;
  presentationUnit: string | null;
  price: number | null;
  currency: string;
  availability: string | null;
  canonicalDomain: string;
  /** Huella del hecho observado. Misma huella = mismo precio ya registrado. */
  externalRef: string;
  sourceUrl: string;
  scrapedAt: string;
}

/** Un sitio a relevar. */
export interface SourceSite {
  url: string;
  canonicalDomain: string;
  discoveryMethod: 'seed' | 'search' | 'directory' | 'manual';
  /** Id de la tienda en `stores`, si esta fuente ya esta asociada a una. */
  storeId?: string;
  /** Etiqueta libre de las semillas, util para agrupar en el reporte. */
  label?: string;
}

export type FetchOutcome =
  | { kind: 'ok'; status: number; url: string; html: string; fromCache: false }
  | { kind: 'not-modified'; status: 304; url: string }
  | { kind: 'skipped'; reason: 'robots' | 'disabled' | 'unchanged'; url: string }
  | { kind: 'error'; url: string; status?: number; message: string };

/** Resultado del scraping de un sitio. Nunca tira: el error viaja adentro. */
export interface SiteResult {
  site: SourceSite;
  status: 'ok' | 'unchanged' | 'skipped' | 'failed';
  company: NormalizedCompany | null;
  products: NormalizedProduct[];
  /** Paginas efectivamente descargadas, para el reporte. */
  pagesFetched: string[];
  error?: string;
  skipReason?: string;
  durationMs: number;
}

/** Estado actual de la base, leido antes de decidir cualquier cosa. */
export interface StoreState {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  canonicalDomain: string | null;
  source: string;
  sourceType: string;
  archivedAt: string | null;
  /** Lo ultimo que escribio el scraper. Base del merge a tres vias. */
  scrapedSnapshot: Record<string, string | null> | null;
}

export interface ItemState {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  category: string | null;
  unit: string | null;
  /** Distingue "por metro" de "rollo 15 m": son items distintos. */
  variantLabel: string | null;
  archivedAt: string | null;
}

export interface DatabaseState {
  stores: StoreState[];
  items: ItemState[];
  /** Huellas de precio ya registradas, para no reinsertar la misma observacion. */
  priceRefs: Set<string>;
  /** Dominios ya presentes en `supplier_sources`. */
  knownDomains: Set<string>;
  /**
   * Dominios que alguien ya descarto en una corrida anterior.
   * Sin esto, un candidato rechazado vuelve a la cola de revision todos los
   * meses: descartar tiene que ser una decision que se respeta.
   */
  dismissedDomains: Set<string>;
  /** De donde salio este estado: 'supabase' o la ruta del snapshot. */
  origin: string;
}

export type CandidateDecision =
  | 'new'
  | 'update'
  | 'duplicate'
  | 'irrelevant'
  | 'needs_review'
  | 'applied'
  | 'discarded';

/** Cambio propuesto sobre una tienda ya conocida. */
export interface StoreUpdatePlan {
  storeId: string;
  storeName: string;
  canonicalDomain: string;
  sourceUrl: string;
  /** Campos que se escriben. Vacio = no hay nada que hacer. */
  changes: Record<string, string | null>;
  /** Campos que cambiaron en el sitio pero los toco una persona. No se escriben. */
  conflicts: FieldConflict[];
  /** Nuevo valor de scraped_snapshot despues de aplicar. */
  nextSnapshot: Record<string, string | null>;
}

export interface FieldConflict {
  fieldName: string;
  base: string | null;
  current: string | null;
  incoming: string | null;
  reason: 'human-edit' | 'protected-field' | 'identity-change';
}

export interface CompanyCandidatePlan {
  company: NormalizedCompany;
  decision: CandidateDecision;
  matchStoreId: string | null;
  matchConfidence: number;
  matchReason: string;
  diff: Record<string, { current: string | null; incoming: string | null }>;
}

export interface ProductCandidatePlan {
  product: NormalizedProduct;
  storeId: string | null;
  matchedItemId: string | null;
  matchConfidence: number;
  matchReason: string;
  decision: CandidateDecision;
  /** true si se puede insertar la observacion de precio directo en la base. */
  priceReady: boolean;
}

/** Todo lo que la corrida propone escribir. La persistencia no decide nada. */
export interface SyncPlan {
  runId: string;
  startedAt: string;
  finishedAt: string;
  mode: string;
  sources: SourceSite[];
  storeUpdates: StoreUpdatePlan[];
  companyCandidates: CompanyCandidatePlan[];
  productCandidates: ProductCandidatePlan[];
  siteResults: SiteResult[];
  discoveryStats: DiscoveryStats;
}

export interface DiscoveryStats {
  provider: string;
  queriesRun: number;
  resultsSeen: number;
  domainsSeen: number;
  alreadyKnown: number;
  rejectedIrrelevant: number;
  newDomains: number;
}
