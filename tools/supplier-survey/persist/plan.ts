/**
 * De resultados de scraping a plan de sincronizacion.
 *
 * Es la unica capa que decide. El scraper no sabe que va a pasar con lo que
 * saco, y el escritor de SQL no decide nada: ejecuta el plan.
 *
 * Las reglas, tal como quedaron acordadas:
 *   - Tienda ya conocida  -> merge a tres vias, se propone UPDATE.
 *   - Empresa nueva       -> queda en `supplier_candidates`. NUNCA entra sola a
 *                            `stores`: es el catalogo que el tecnico ve al
 *                            elegir el origen de un material.
 *   - Coincidencia dudosa -> `needs_review`.
 *   - Fuera del rubro     -> `irrelevant`, no llega a la cola de revision.
 *   - Producto con item y tienda conocidos -> la observacion de precio SI se
 *     inserta: `store_item_prices` es un historico, insertar no pisa nada.
 */

import type {
  CompanyCandidatePlan,
  DatabaseState,
  DiscoveryStats,
  NormalizedCompany,
  ProductCandidatePlan,
  SiteResult,
  SourceSite,
  StoreUpdatePlan,
  SyncPlan,
} from '../core/types.ts';
import { AUTO_MATCH_THRESHOLD, ITEM_MATCH_THRESHOLD, matchCompany, matchItem } from '../dedupe/match.ts';
import { RELEVANCE_THRESHOLD } from '../discovery/relevance.ts';
import { isNoopUpdate, planStoreUpdate } from '../merge/threeWay.ts';
import type { RunContext } from '../core/runContext.ts';

export interface BuildPlanOptions {
  run: RunContext;
  state: DatabaseState;
  siteResults: readonly SiteResult[];
  sources: readonly SourceSite[];
  discoveryStats: DiscoveryStats;
}

const diffAgainstStore = (
  company: NormalizedCompany,
  state: DatabaseState,
  storeId: string | null,
): Record<string, { current: string | null; incoming: string | null }> => {
  const store = storeId ? state.stores.find((entry) => entry.id === storeId) : undefined;
  if (!store) return {};

  const diff: Record<string, { current: string | null; incoming: string | null }> = {};
  const pairs: Array<[string, string | null, string | null]> = [
    ['name', store.name, company.name],
    ['address', store.address, company.address],
    ['phone', store.phone, company.phone],
    ['email', store.email, company.email],
    ['website', store.website, company.website],
  ];

  for (const [fieldName, current, incoming] of pairs) {
    if (incoming === null || (current ?? '') === (incoming ?? '')) continue;
    diff[fieldName] = { current, incoming };
  }

  return diff;
};

export const buildSyncPlan = ({ run, state, siteResults, sources, discoveryStats }: BuildPlanOptions): SyncPlan => {
  const storeUpdates: StoreUpdatePlan[] = [];
  const companyCandidates: CompanyCandidatePlan[] = [];
  const productCandidates: ProductCandidatePlan[] = [];

  /** Dominios ya resueltos en esta corrida: dos fuentes pueden dar el mismo. */
  const resolvedDomains = new Set<string>();

  for (const result of siteResults) {
    const company = result.company;
    if (result.status !== 'ok' || !company) continue;

    if (resolvedDomains.has(company.canonicalDomain)) {
      companyCandidates.push({
        company,
        decision: 'duplicate',
        matchStoreId: null,
        matchConfidence: 100,
        matchReason: 'otro resultado de esta misma corrida ya cubrio el dominio',
        diff: {},
      });
      continue;
    }
    resolvedDomains.add(company.canonicalDomain);

    // Ya lo descartaron antes. Volver a proponerlo seria ignorar la decision.
    if (state.dismissedDomains.has(company.canonicalDomain)) {
      companyCandidates.push({
        company,
        decision: 'discarded',
        matchStoreId: null,
        matchConfidence: 0,
        matchReason: 'descartado en una corrida anterior',
        diff: {},
      });
      continue;
    }

    // Fuera del rubro: se registra para no volver a proponerlo, pero no ocupa
    // lugar en la cola de revision.
    if (company.relevanceScore < RELEVANCE_THRESHOLD) {
      companyCandidates.push({
        company,
        decision: 'irrelevant',
        matchStoreId: null,
        matchConfidence: 0,
        matchReason: `relevancia ${company.relevanceScore} debajo del umbral ${RELEVANCE_THRESHOLD}`,
        diff: {},
      });
      continue;
    }

    const match = matchCompany(company, state.stores);
    const storeId = match.storeId;

    if (storeId !== null && match.confidence >= AUTO_MATCH_THRESHOLD) {
      const store = state.stores.find((entry) => entry.id === storeId);

      if (store) {
        const update = planStoreUpdate(store, company);

        // Con conflictos, ademas del update va un candidato a revision para que
        // quede visible que el sitio dice otra cosa que la base.
        if (!isNoopUpdate(update)) storeUpdates.push(update);

        companyCandidates.push({
          company,
          decision: update.conflicts.length > 0 ? 'needs_review' : 'update',
          matchStoreId: storeId,
          matchConfidence: match.confidence,
          matchReason: match.reason,
          diff: diffAgainstStore(company, state, storeId),
        });

        addProducts(productCandidates, result, storeId, state);
        continue;
      }
    }

    // Coincidencia parcial: puede ser la misma empresa mal escrita. A revision.
    if (storeId !== null) {
      companyCandidates.push({
        company,
        decision: 'needs_review',
        matchStoreId: storeId,
        matchConfidence: match.confidence,
        matchReason: `posible duplicado: ${match.reason}`,
        diff: diffAgainstStore(company, state, storeId),
      });

      addProducts(productCandidates, result, null, state);
      continue;
    }

    // Empresa nueva. Se queda en staging hasta que alguien la apruebe.
    companyCandidates.push({
      company,
      decision: 'new',
      matchStoreId: null,
      matchConfidence: 0,
      matchReason: 'sin coincidencias en el catalogo',
      diff: {},
    });

    addProducts(productCandidates, result, null, state);
  }

  return {
    runId: run.runId,
    startedAt: run.startedAt,
    finishedAt: run.now().toISOString(),
    mode: run.mode,
    sources: [...sources],
    storeUpdates,
    companyCandidates,
    productCandidates,
    siteResults: [...siteResults],
    discoveryStats,
  };
};

/**
 * Un precio se puede escribir en la base solo si sabemos a que tienda y a que
 * item pertenece, y si esa observacion exacta no esta ya registrada. Todo lo
 * demas queda como candidato de producto.
 */
const addProducts = (
  target: ProductCandidatePlan[],
  result: SiteResult,
  storeId: string | null,
  state: DatabaseState,
): void => {
  for (const product of result.products) {
    const match = matchItem(product, state.items);
    const alreadyRecorded = state.priceRefs.has(product.externalRef);

    const priceReady =
      storeId !== null &&
      match.itemId !== null &&
      match.confidence >= ITEM_MATCH_THRESHOLD &&
      product.price !== null &&
      !alreadyRecorded;

    const decision: ProductCandidatePlan['decision'] = alreadyRecorded
      ? 'duplicate'
      : priceReady
        ? 'update'
        : match.itemId !== null
          ? 'needs_review'
          : 'new';

    target.push({
      product,
      storeId,
      matchedItemId: match.itemId,
      matchConfidence: match.confidence,
      matchReason: alreadyRecorded ? 'la observacion ya estaba registrada' : match.reason,
      decision,
      priceReady,
    });
  }
};
