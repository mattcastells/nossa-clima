/**
 * Configuracion del relevamiento.
 *
 * Todo lo ajustable vive aca. Los valores por defecto son deliberadamente
 * conservadores: es mejor una corrida lenta y educada que una rapida que nos
 * haga bloquear.
 */

import path from 'node:path';

export interface SurveyConfig {
  /** Identificador que queda en `stores.source`. */
  readonly sourceName: string;
  readonly userAgent: string;

  readonly http: {
    readonly timeoutMs: number;
    readonly maxRetries: number;
    readonly minDelayMs: number;
    readonly maxConcurrent: number;
    readonly maxBodyBytes: number;
    readonly respectRobots: boolean;
  };

  /** Paginas internas que se visitan ademas de la home, en orden de prioridad. */
  readonly contactPaths: readonly string[];
  readonly productPaths: readonly string[];
  /** Tope de paginas por sitio. Sin esto, un catalogo grande no termina nunca. */
  readonly maxPagesPerSite: number;

  readonly discovery: {
    readonly provider: 'file' | 'serper' | 'brave' | 'none';
    readonly maxResultsPerQuery: number;
    readonly maxNewDomains: number;
    /** Codigo de pais para las busquedas. */
    readonly country: string;
    readonly language: string;
  };

  readonly paths: {
    readonly root: string;
    readonly seeds: string;
    readonly queries: string;
    readonly candidates: string;
    readonly cache: string;
    readonly output: string;
  };
}

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

export const DEFAULT_CONFIG: SurveyConfig = {
  sourceName: 'air_conditioning_scraper',
  // UA identificable y con forma de contacto: si molestamos, que puedan avisar.
  userAgent: 'NossaClimaBot/1.0 (+https://github.com/mattcastells/nossa-clima; relevamiento de proveedores)',

  http: {
    timeoutMs: 15_000,
    maxRetries: 2,
    minDelayMs: 2_000,
    maxConcurrent: 3,
    maxBodyBytes: 2_000_000,
    respectRobots: true,
  },

  contactPaths: ['/contacto', '/contactanos', '/contact', '/nosotros', '/quienes-somos', '/sucursales', '/institucional'],
  productPaths: ['/productos', '/catalogo', '/tienda', '/shop', '/categoria-producto'],
  maxPagesPerSite: 6,

  discovery: {
    provider: 'file',
    maxResultsPerQuery: 10,
    maxNewDomains: 40,
    country: 'ar',
    language: 'es',
  },

  paths: {
    root: ROOT,
    seeds: path.join(ROOT, 'seeds', 'sources.json'),
    queries: path.join(ROOT, 'seeds', 'queries.json'),
    candidates: path.join(ROOT, 'seeds', 'candidates.json'),
    cache: path.join(ROOT, '.cache'),
    output: path.join(ROOT, '..', '..', 'artifacts', 'supplier-survey'),
  },
};

export interface ConfigOverrides {
  provider?: SurveyConfig['discovery']['provider'];
  maxNewDomains?: number;
  minDelayMs?: number;
  maxConcurrent?: number;
  maxPagesPerSite?: number;
  respectRobots?: boolean;
  output?: string;
  seeds?: string;
  candidates?: string;
  cache?: string;
}

export const buildConfig = (overrides: ConfigOverrides = {}): SurveyConfig => ({
  ...DEFAULT_CONFIG,
  http: {
    ...DEFAULT_CONFIG.http,
    ...(overrides.minDelayMs !== undefined ? { minDelayMs: overrides.minDelayMs } : {}),
    ...(overrides.maxConcurrent !== undefined ? { maxConcurrent: overrides.maxConcurrent } : {}),
    ...(overrides.respectRobots !== undefined ? { respectRobots: overrides.respectRobots } : {}),
  },
  ...(overrides.maxPagesPerSite !== undefined ? { maxPagesPerSite: overrides.maxPagesPerSite } : {}),
  discovery: {
    ...DEFAULT_CONFIG.discovery,
    ...(overrides.provider !== undefined ? { provider: overrides.provider } : {}),
    ...(overrides.maxNewDomains !== undefined ? { maxNewDomains: overrides.maxNewDomains } : {}),
  },
  paths: {
    ...DEFAULT_CONFIG.paths,
    ...(overrides.seeds !== undefined ? { seeds: overrides.seeds } : {}),
    ...(overrides.candidates !== undefined ? { candidates: overrides.candidates } : {}),
    ...(overrides.cache !== undefined ? { cache: overrides.cache } : {}),
    ...(overrides.output !== undefined ? { output: overrides.output } : {}),
  },
});

/** Credenciales de lectura de Supabase. Nunca la service_role. */
export interface SupabaseCredentials {
  url: string;
  anonKey: string;
  email: string;
  password: string;
}

/**
 * Lee las credenciales del entorno. Devuelve null si faltan: el pipeline sabe
 * seguir sin base, leyendo un snapshot local.
 */
export const readSupabaseCredentials = (env: NodeJS.ProcessEnv = process.env): SupabaseCredentials | null => {
  const url = env.EXPO_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;
  const email = env.SURVEY_SUPABASE_EMAIL ?? env.KEEPALIVE_EMAIL;
  const password = env.SURVEY_SUPABASE_PASSWORD ?? env.KEEPALIVE_PASSWORD;

  if (!url || !anonKey || !email || !password) return null;

  return { url, anonKey, email, password };
};

/** Key del proveedor de busqueda, si esta configurada. */
export const readSearchApiKey = (
  provider: SurveyConfig['discovery']['provider'],
  env: NodeJS.ProcessEnv = process.env,
): string | null => {
  if (provider === 'serper') return env.SERPER_API_KEY ?? null;
  if (provider === 'brave') return env.BRAVE_SEARCH_API_KEY ?? null;
  return null;
};
