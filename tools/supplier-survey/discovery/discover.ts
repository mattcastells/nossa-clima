/**
 * Discovery: buscar empresas que todavia no tenemos.
 *
 * El trabajo real no es buscar, es descartar. Un resultado de busqueda pasa
 * por cuatro filtros antes de convertirse en un sitio a relevar:
 *   1. ¿la URL da un dominio registrable? (descarta IPs, PDFs, basura)
 *   2. ¿ya lo conocemos? (dominio en `stores` o en `supplier_sources`)
 *   3. ¿es del rubro? (scoring sobre titulo y snippet)
 *   4. ¿ya lo trajo otra consulta en esta misma corrida?
 */

import type { DiscoveryStats, SourceSite } from '../core/types.ts';
import type { Logger } from '../core/logger.ts';
import { canonicalDomain, canonicalUrl } from '../normalize/domain.ts';
import type { SearchProvider, SearchResult } from './provider.ts';
import { scoreRelevance } from './relevance.ts';

export interface DiscoverOptions {
  provider: SearchProvider;
  queries: readonly string[];
  /** Dominios que ya estan en la base. No vuelven a proponerse. */
  knownDomains: ReadonlySet<string>;
  maxResultsPerQuery: number;
  maxNewDomains: number;
  logger: Logger;
}

export interface DiscoveryOutcome {
  sites: SourceSite[];
  stats: DiscoveryStats;
  /** Descartes con su motivo, para que el reporte explique que se tiro y por que. */
  rejected: Array<{ url: string; domain: string | null; reason: string; score: number }>;
}

export const discoverNewSites = async ({
  provider,
  queries,
  knownDomains,
  maxResultsPerQuery,
  maxNewDomains,
  logger,
}: DiscoverOptions): Promise<DiscoveryOutcome> => {
  const seen = new Set<string>();
  const sites: SourceSite[] = [];
  const rejected: DiscoveryOutcome['rejected'] = [];

  const stats: DiscoveryStats = {
    provider: provider.name,
    queriesRun: 0,
    resultsSeen: 0,
    domainsSeen: 0,
    alreadyKnown: 0,
    rejectedIrrelevant: 0,
    newDomains: 0,
  };

  for (const query of queries) {
    if (sites.length >= maxNewDomains) {
      logger.info(`tope de ${maxNewDomains} dominios nuevos alcanzado, corto el discovery`);
      break;
    }

    let results: SearchResult[] = [];
    try {
      results = await provider.search(query, maxResultsPerQuery);
    } catch (error) {
      logger.warn(`la consulta "${query}" fallo: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    stats.queriesRun += 1;
    stats.resultsSeen += results.length;

    for (const result of results) {
      if (sites.length >= maxNewDomains) break;

      const domain = canonicalDomain(result.url);
      if (!domain) {
        rejected.push({ url: result.url, domain: null, reason: 'URL sin dominio utilizable', score: 0 });
        continue;
      }

      if (seen.has(domain)) continue;
      seen.add(domain);
      stats.domainsSeen += 1;

      if (knownDomains.has(domain)) {
        stats.alreadyKnown += 1;
        continue;
      }

      // Con titulo y snippet alcanza para descartar lo obvio sin gastar un
      // request. Lo que pase este filtro se valida de nuevo con la pagina real.
      const relevance = scoreRelevance(`${result.title} ${result.snippet} ${domain}`);
      if (!relevance.isRelevant) {
        stats.rejectedIrrelevant += 1;
        rejected.push({
          url: result.url,
          domain,
          reason: relevance.rejected.length > 0 ? `senales negativas: ${relevance.rejected.join(', ')}` : 'sin senal del rubro',
          score: relevance.score,
        });
        continue;
      }

      const url = canonicalUrl(result.url);
      if (!url) continue;

      sites.push({ url, canonicalDomain: domain, discoveryMethod: 'search', label: query });
      stats.newDomains += 1;
      logger.debug(`candidato: ${domain} (${relevance.score} pts) via "${query}"`);
    }
  }

  return { sites, stats, rejected };
};
