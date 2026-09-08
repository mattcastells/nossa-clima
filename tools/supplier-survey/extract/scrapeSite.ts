/**
 * Relevamiento de un sitio.
 *
 * Es la unidad de aislamiento del pipeline: pase lo que pase acá adentro,
 * devuelve un `SiteResult`. Nunca tira. Si un sitio se cae, se cuelga o emite
 * HTML roto, queda registrado como `failed` y los demas siguen.
 *
 * Recorrido: home -> pagina de contacto -> paginas de producto, con tope de
 * `maxPagesPerSite`. Las paginas internas se buscan primero entre los enlaces
 * reales de la home (que es lo que existe) y recien despues por las rutas
 * convencionales (que puede que no existan).
 */

import type { SurveyConfig } from '../config.ts';
import type { Logger } from '../core/logger.ts';
import type { NormalizedProduct, SiteResult, SourceSite } from '../core/types.ts';
import { scoreRelevance } from '../discovery/relevance.ts';
import type { HttpClient } from '../net/httpClient.ts';
import { isUsableCompany, normalizeCompany } from '../normalize/company.ts';
import { canonicalUrl, isSameSite } from '../normalize/domain.ts';
import { dedupeProducts, normalizeProduct } from '../normalize/product.ts';
import { extractJsonLd, extractLinks, extractMetaTags, flattenJsonLd, visibleText } from './html.ts';
import { extractCompany, extractProducts } from './registry.ts';
import type { PageContext } from './types.ts';

const CONTACT_HINTS = ['contacto', 'contactanos', 'contact', 'nosotros', 'quienes somos', 'sucursal', 'donde estamos'];
const PRODUCT_HINTS = ['producto', 'catalogo', 'tienda', 'shop', 'categoria', 'insumos'];

export const buildPageContext = (url: string, html: string, scrapedAt: string): PageContext => ({
  url,
  html,
  text: visibleText(html),
  metaTags: extractMetaTags(html),
  jsonLdNodes: flattenJsonLd(extractJsonLd(html)),
  scrapedAt,
});

/**
 * Elige hasta `limit` enlaces internos que parezcan de contacto o de producto.
 * Preferimos los que declara el propio sitio antes que adivinar rutas.
 */
const pickInternalLinks = (page: PageContext, hints: readonly string[], limit: number): string[] => {
  const picked: string[] = [];
  const seen = new Set<string>();

  for (const link of extractLinks(page.html)) {
    if (picked.length >= limit) break;
    if (/^(mailto:|tel:|javascript:|#)/i.test(link.href)) continue;

    const absolute = canonicalUrl(link.href, page.url);
    if (!absolute || !isSameSite(absolute, page.url)) continue;
    if (seen.has(absolute) || absolute === page.url) continue;

    const haystack = `${link.href} ${link.text}`.toLowerCase();
    if (!hints.some((hint) => haystack.includes(hint))) continue;

    seen.add(absolute);
    picked.push(absolute);
  }

  return picked;
};

interface ScrapeSiteOptions {
  site: SourceSite;
  client: HttpClient;
  config: SurveyConfig;
  scrapedAt: string;
  logger: Logger;
  /** Ignora la cache y vuelve a bajar todo. */
  force?: boolean;
}

export const scrapeSite = async ({
  site,
  client,
  config,
  scrapedAt,
  logger,
  force = false,
}: ScrapeSiteOptions): Promise<SiteResult> => {
  const startedAt = Date.now();
  const pagesFetched: string[] = [];

  const finish = (result: Omit<SiteResult, 'site' | 'pagesFetched' | 'durationMs'>): SiteResult => ({
    site,
    pagesFetched,
    durationMs: Date.now() - startedAt,
    ...result,
  });

  try {
    const home = await client.fetchPage(site.url, { force });

    if (home.kind === 'error') {
      logger.warn(`${site.canonicalDomain}: ${home.message}`);
      return finish({ status: 'failed', company: null, products: [], error: home.message });
    }

    if (home.kind === 'skipped') {
      const reason = home.reason === 'robots' ? 'robots.txt no lo permite' : 'sin cambios desde la ultima corrida';
      return finish({
        status: home.reason === 'robots' ? 'skipped' : 'unchanged',
        company: null,
        products: [],
        skipReason: reason,
      });
    }

    if (home.kind === 'not-modified') {
      return finish({ status: 'unchanged', company: null, products: [], skipReason: 'el sitio respondio 304' });
    }

    pagesFetched.push(home.url);
    const homePage = buildPageContext(home.url, home.html, scrapedAt);

    // Filtro de relevancia sobre la pagina real. Un dominio puede haber pasado
    // el filtro del snippet y no ser del rubro.
    const relevance = scoreRelevance(`${homePage.text.slice(0, 20_000)} ${site.canonicalDomain}`);

    const pages: PageContext[] = [homePage];
    const productPages: PageContext[] = [];

    const budget = Math.max(0, config.maxPagesPerSite - 1);
    const contactBudget = Math.min(2, budget);
    const productBudget = budget - contactBudget;

    const contactUrls = [
      ...pickInternalLinks(homePage, CONTACT_HINTS, contactBudget),
      ...config.contactPaths.map((suffix) => canonicalUrl(suffix, home.url)).filter((url): url is string => url !== null),
    ];

    for (const url of unique(contactUrls).slice(0, contactBudget)) {
      const page = await fetchInto(client, url, scrapedAt, force);
      if (!page) continue;
      pagesFetched.push(url);
      pages.push(page);
    }

    const productUrls = [
      ...pickInternalLinks(homePage, PRODUCT_HINTS, productBudget),
      ...config.productPaths.map((suffix) => canonicalUrl(suffix, home.url)).filter((url): url is string => url !== null),
    ];

    for (const url of unique(productUrls).slice(0, productBudget)) {
      const page = await fetchInto(client, url, scrapedAt, force);
      if (!page) continue;
      pagesFetched.push(url);
      pages.push(page);
      productPages.push(page);
    }

    // Empresa: se fusiona lo de todas las paginas. La de contacto suele tener
    // la direccion y el telefono que la home no muestra.
    const extractions = pages.map((page) => extractCompany(page));
    const merged = mergeExtractions(extractions);

    for (const error of merged.errors) logger.debug(`${site.canonicalDomain}: ${error}`);

    const company = normalizeCompany({
      raw: merged.company,
      sourceUrl: home.url,
      scrapedAt,
      relevanceScore: relevance.score,
      categories: relevance.matched,
    });

    if (!company || !isUsableCompany(company)) {
      return finish({
        status: 'failed',
        company: null,
        products: [],
        error: 'no se pudo extraer un nombre de empresa utilizable',
      });
    }

    const products = collectProducts([homePage, ...productPages], site.canonicalDomain, scrapedAt, logger);

    logger.info(
      `${site.canonicalDomain}: ${company.name} · ${products.length} producto(s) · relevancia ${relevance.score}`,
    );

    return finish({ status: 'ok', company, products });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`${site.canonicalDomain}: error inesperado: ${message}`);
    return finish({ status: 'failed', company: null, products: [], error: message });
  }
};

const unique = (values: readonly string[]): string[] => [...new Set(values)];

const fetchInto = async (
  client: HttpClient,
  url: string,
  scrapedAt: string,
  force: boolean,
): Promise<PageContext | null> => {
  const outcome = await client.fetchPage(url, { force });

  if (outcome.kind === 'ok') return buildPageContext(outcome.url, outcome.html, scrapedAt);

  // Sin cambios: reusamos el cuerpo cacheado en vez de perder la pagina.
  if (outcome.kind === 'not-modified' || (outcome.kind === 'skipped' && outcome.reason === 'unchanged')) {
    const body = await client.cachedBody(url);
    return body ? buildPageContext(url, body, scrapedAt) : null;
  }

  return null;
};

/** Fusiona las extracciones de varias paginas del mismo sitio. */
const mergeExtractions = (
  extractions: ReadonlyArray<ReturnType<typeof extractCompany>>,
): { company: ReturnType<typeof extractCompany>['company']; errors: string[] } => {
  const errors = extractions.flatMap((extraction) => extraction.errors);
  // `mergeCompanies` ya resuelve por confianza; le pasamos todas las paginas.
  const companies = extractions.map((extraction) => extraction.company);

  return {
    company: companies.reduce((accumulator, current) => {
      for (const [key, value] of Object.entries(current)) {
        if (value === undefined) continue;
        const existing = (accumulator as Record<string, { provenance: { confidence: number } } | undefined>)[key];
        if (!existing || value.provenance.confidence > existing.provenance.confidence) {
          (accumulator as Record<string, unknown>)[key] = value;
        }
      }
      return accumulator;
    }, {}),
    errors,
  };
};

const collectProducts = (
  pages: readonly PageContext[],
  canonicalDomain: string,
  scrapedAt: string,
  logger: Logger,
): NormalizedProduct[] => {
  const collected: NormalizedProduct[] = [];

  for (const page of pages) {
    const { products, strategy, errors } = extractProducts(page);
    for (const error of errors) logger.debug(`${canonicalDomain}: ${error}`);
    if (products.length === 0) continue;

    logger.debug(`${page.url}: ${products.length} producto(s) via ${strategy}`);

    for (const raw of products) {
      const normalized = normalizeProduct({ raw, canonicalDomain, sourceUrl: page.url, scrapedAt });
      if (normalized) collected.push(normalized);
    }
  }

  return dedupeProducts(collected);
};
