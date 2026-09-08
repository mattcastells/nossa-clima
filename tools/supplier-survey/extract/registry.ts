/**
 * Registro de estrategias y fusion de resultados.
 *
 * CONFIANZA (el orden importa, y es el unico lugar donde se decide):
 *   0.95  json-ld     dato estructurado que el sitio publica para buscadores
 *   0.80  microdata   idem, formato viejo
 *   0.70  meta-tags   Open Graph: estable, pero pensado para compartir, no para datos
 *   0.40  heuristics  leer el texto. Solo completa huecos.
 *
 * Cuando dos estrategias dan valores distintos para el mismo campo gana la de
 * confianza mas alta, y queda registrado en la procedencia cual fue.
 */

import type { RawCompany, RawProduct, Field } from '../core/types.ts';
import { heuristicsCompanyStrategy } from './strategies/heuristics.ts';
import { jsonLdCompanyStrategy, jsonLdProductStrategy } from './strategies/jsonLd.ts';
import { metaTagsCompanyStrategy, metaTagsProductStrategy } from './strategies/metaTags.ts';
import { microdataCompanyStrategy, microdataProductStrategy } from './strategies/microdata.ts';
import type { CompanyStrategy, PageContext, ProductStrategy } from './types.ts';

export const COMPANY_STRATEGIES: readonly CompanyStrategy[] = [
  jsonLdCompanyStrategy,
  microdataCompanyStrategy,
  metaTagsCompanyStrategy,
  heuristicsCompanyStrategy,
];

export const PRODUCT_STRATEGIES: readonly ProductStrategy[] = [
  jsonLdProductStrategy,
  microdataProductStrategy,
  metaTagsProductStrategy,
];

const COMPANY_FIELDS = [
  'name',
  'legalName',
  'description',
  'address',
  'phone',
  'email',
  'website',
  'categories',
] as const;

type CompanyFieldName = (typeof COMPANY_FIELDS)[number];

/** Gana la confianza mas alta; a igual confianza, la primera que llego. */
export const mergeCompanies = (results: readonly RawCompany[]): RawCompany => {
  const merged: RawCompany = {};

  for (const fieldName of COMPANY_FIELDS) {
    let best: Field<unknown> | undefined;

    for (const result of results) {
      const candidate = result[fieldName] as Field<unknown> | undefined;
      if (!candidate) continue;
      if (!best || candidate.provenance.confidence > best.provenance.confidence) best = candidate;
    }

    if (best) assignCompanyField(merged, fieldName, best);
  }

  return merged;
};

/** El cast esta acotado a esta funcion; el resto del pipeline es tipado. */
const assignCompanyField = (target: RawCompany, fieldName: CompanyFieldName, value: Field<unknown>): void => {
  if (fieldName === 'categories') {
    target.categories = value as Field<string[]>;
    return;
  }
  target[fieldName] = value as Field<string>;
};

/**
 * Corre las estrategias que apliquen y fusiona. Una estrategia que revienta no
 * puede tumbar el relevamiento del sitio: se registra y se sigue con las otras.
 */
export const extractCompany = (
  page: PageContext,
  strategies: readonly CompanyStrategy[] = COMPANY_STRATEGIES,
): { company: RawCompany; strategiesUsed: string[]; errors: string[] } => {
  const results: RawCompany[] = [];
  const strategiesUsed: string[] = [];
  const errors: string[] = [];

  for (const strategy of strategies) {
    try {
      if (!strategy.canHandle(page)) continue;
      const result = strategy.extract(page);
      if (Object.keys(result).length === 0) continue;
      results.push(result);
      strategiesUsed.push(strategy.name);
    } catch (error) {
      errors.push(`${strategy.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { company: mergeCompanies(results), strategiesUsed, errors };
};

/**
 * Productos de una pagina. A diferencia de la empresa no se fusionan campo a
 * campo: gana entera la estrategia de mayor confianza que haya devuelto algo,
 * porque mezclar el precio de una estrategia con el nombre de otra es como se
 * arma un precio equivocado.
 */
export const extractProducts = (
  page: PageContext,
  strategies: readonly ProductStrategy[] = PRODUCT_STRATEGIES,
): { products: RawProduct[]; strategy: string | null; errors: string[] } => {
  const errors: string[] = [];
  const ordered = [...strategies].sort((a, b) => b.confidence - a.confidence);

  for (const strategy of ordered) {
    try {
      if (!strategy.canHandle(page)) continue;
      const products = strategy.extract(page);
      if (products.length > 0) return { products, strategy: strategy.name, errors };
    } catch (error) {
      errors.push(`${strategy.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { products: [], strategy: null, errors };
};
