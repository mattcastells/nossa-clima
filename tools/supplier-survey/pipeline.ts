/**
 * Orquestacion de la corrida mensual.
 *
 *   cargar estado de la base
 *        v
 *   actualizar sitios conocidos  ──┐
 *        v                         │  cada sitio aislado: el que falla
 *   discovery de sitios nuevos     │  no frena a los demas
 *        v                       ──┘
 *   normalizar / deduplicar / mergear   (persist/plan.ts)
 *        v
 *   emitir SQL + reporte
 *
 * Esta funcion no escribe en la base ni sabe de formato de salida. Devuelve el
 * plan; la CLI decide que hacer con el.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { SurveyConfig } from './config.ts';
import { readSearchApiKey } from './config.ts';
import type { Logger } from './core/logger.ts';
import type { RunContext } from './core/runContext.ts';
import type { DatabaseState, DiscoveryStats, SiteResult, SourceSite, SyncPlan } from './core/types.ts';
import { discoverNewSites } from './discovery/discover.ts';
import { createFileProvider } from './discovery/providers/fileProvider.ts';
import { createBraveProvider, createSerperProvider } from './discovery/providers/httpProviders.ts';
import { noopProvider, type SearchProvider } from './discovery/provider.ts';
import { scrapeSite } from './extract/scrapeSite.ts';
import { HttpCache } from './net/cache.ts';
import { HttpClient } from './net/httpClient.ts';
import { RateLimiter } from './net/rateLimiter.ts';
import { canonicalDomain, canonicalUrl } from './normalize/domain.ts';
import { buildSyncPlan } from './persist/plan.ts';

export type SurveyMode = 'full' | 'update' | 'discover';

export interface PipelineOptions {
  run: RunContext;
  config: SurveyConfig;
  state: DatabaseState;
  seeds: readonly SourceSite[];
  queries: readonly string[];
  mode: SurveyMode;
  logger: Logger;
  force?: boolean;
  /** Inyectable para tests. */
  fetchImpl?: typeof fetch;
  supabase?: SupabaseClient | null;
}

const emptyDiscoveryStats = (provider: string): DiscoveryStats => ({
  provider,
  queriesRun: 0,
  resultsSeen: 0,
  domainsSeen: 0,
  alreadyKnown: 0,
  rejectedIrrelevant: 0,
  newDomains: 0,
});

export const buildSearchProvider = (config: SurveyConfig, logger: Logger, fetchImpl?: typeof fetch): SearchProvider => {
  const { provider } = config.discovery;
  if (provider === 'none') return noopProvider;
  if (provider === 'file') return createFileProvider(config.paths.candidates);

  const apiKey = readSearchApiKey(provider);
  if (!apiKey) {
    // Sin key no fallamos: caemos al archivo, que siempre esta disponible.
    logger.warn(`falta la API key de ${provider}; uso el archivo de candidatos`);
    return createFileProvider(config.paths.candidates);
  }

  const options = {
    apiKey,
    country: config.discovery.country,
    language: config.discovery.language,
    logger,
    ...(fetchImpl ? { fetchImpl } : {}),
  };

  return provider === 'serper' ? createSerperProvider(options) : createBraveProvider(options);
};

/**
 * Sitios de tiendas que ya estan en la base y tienen web declarada. Se suman a
 * las semillas del archivo: si alguien cargo una web a mano en la app, el
 * relevamiento la toma sin que nadie tenga que copiarla al JSON.
 */
export const sitesFromState = (state: DatabaseState): SourceSite[] => {
  const sites: SourceSite[] = [];

  for (const store of state.stores) {
    if (store.archivedAt !== null) continue;

    const raw = store.website ?? (store.canonicalDomain ? `https://${store.canonicalDomain}` : null);
    if (!raw) continue;

    const url = canonicalUrl(raw);
    const domain = canonicalDomain(raw);
    if (!url || !domain) continue;

    sites.push({ url, canonicalDomain: domain, discoveryMethod: 'seed', storeId: store.id, label: store.name });
  }

  return sites;
};

/** Une semillas y sitios de la base sin repetir dominio. */
export const mergeSites = (...groups: ReadonlyArray<readonly SourceSite[]>): SourceSite[] => {
  const byDomain = new Map<string, SourceSite>();

  for (const group of groups) {
    for (const site of group) {
      const existing = byDomain.get(site.canonicalDomain);
      // El que viene con storeId gana: sabemos a que tienda pertenece.
      if (!existing || (existing.storeId === undefined && site.storeId !== undefined)) {
        byDomain.set(site.canonicalDomain, site);
      }
    }
  }

  return [...byDomain.values()];
};

export const runPipeline = async ({
  run,
  config,
  state,
  seeds,
  queries,
  mode,
  logger,
  force = false,
  fetchImpl,
}: PipelineOptions): Promise<SyncPlan> => {
  const rateLimiter = new RateLimiter({
    minDelayMs: config.http.minDelayMs,
    maxConcurrent: config.http.maxConcurrent,
  });

  const client = new HttpClient({
    userAgent: config.userAgent,
    timeoutMs: config.http.timeoutMs,
    maxRetries: config.http.maxRetries,
    maxBodyBytes: config.http.maxBodyBytes,
    respectRobots: config.http.respectRobots,
    cache: new HttpCache(config.paths.cache),
    rateLimiter,
    logger,
    ...(fetchImpl ? { fetchImpl } : {}),
  });

  // ---- Sitios conocidos ----------------------------------------------------
  const knownSites = mode === 'discover' ? [] : mergeSites(seeds, sitesFromState(state));

  if (mode !== 'discover') {
    logger.step(`Actualizando ${knownSites.length} sitio(s) conocido(s)`);
  }

  const siteResults: SiteResult[] = [];
  for (const site of knownSites) {
    siteResults.push(await scrapeSite({ site, client, config, scrapedAt: run.scrapedAt, logger, force }));
  }

  // ---- Discovery -----------------------------------------------------------
  let discoveryStats = emptyDiscoveryStats('none');
  let discoveredSites: SourceSite[] = [];

  if (mode !== 'update') {
    const provider = buildSearchProvider(config, logger, fetchImpl);
    logger.step(`Discovery con proveedor "${provider.name}"`);

    // Todo lo que ya conocemos o ya descartamos: la base, lo descartado en
    // corridas anteriores, y lo que acabamos de relevar.
    const knownDomains = new Set([
      ...state.knownDomains,
      ...state.dismissedDomains,
      ...knownSites.map((site) => site.canonicalDomain),
      ...state.stores.map((store) => store.canonicalDomain).filter((domain): domain is string => domain !== null),
    ]);

    const outcome = await discoverNewSites({
      provider,
      queries,
      knownDomains,
      maxResultsPerQuery: config.discovery.maxResultsPerQuery,
      maxNewDomains: config.discovery.maxNewDomains,
      logger,
    });

    discoveryStats = outcome.stats;
    discoveredSites = outcome.sites;

    logger.info(
      `${outcome.stats.resultsSeen} resultado(s) · ${outcome.stats.alreadyKnown} ya conocido(s) · ` +
        `${outcome.stats.rejectedIrrelevant} descartado(s) · ${outcome.stats.newDomains} nuevo(s)`,
    );

    if (discoveredSites.length > 0) {
      logger.step(`Relevando ${discoveredSites.length} sitio(s) nuevo(s)`);
      for (const site of discoveredSites) {
        siteResults.push(await scrapeSite({ site, client, config, scrapedAt: run.scrapedAt, logger, force }));
      }
    }
  }

  // ---- Normalizar, deduplicar, mergear ------------------------------------
  logger.step('Deduplicando y armando el plan');

  return buildSyncPlan({
    run,
    state,
    siteResults,
    sources: mergeSites(knownSites, discoveredSites),
    discoveryStats,
  });
};
