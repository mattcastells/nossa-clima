import { describe, expect, it } from 'vitest';

import { silentLogger } from '../core/logger.ts';
import { createRunContext } from '../core/runContext.ts';
import type { DatabaseState, SiteResult, SourceSite, StoreState } from '../core/types.ts';
import { discoverNewSites } from '../discovery/discover.ts';
import { parseCandidatesFile } from '../discovery/providers/fileProvider.ts';
import type { SearchProvider } from '../discovery/provider.ts';
import { RELEVANCE_THRESHOLD, scoreRelevance } from '../discovery/relevance.ts';
import { isPathAllowed, parseRobots } from '../net/robots.ts';
import { RateLimiter } from '../net/rateLimiter.ts';
import { buildSyncPlan } from '../persist/plan.ts';
import { quote, quoteJsonb, quoteTextArray, renderSyncSql } from '../persist/sql.ts';
import { buildReport, renderMarkdown } from '../report/report.ts';
import { mergeSites, sitesFromState } from '../pipeline.ts';

const AT = '2026-09-08T12:00:00.000Z';

const store = (overrides: Partial<StoreState>): StoreState => ({
  id: 'store-1',
  name: 'Pizarro',
  description: '8:30-17',
  address: 'Av. de los Constituyentes 3729',
  phone: '1145712411',
  email: null,
  website: null,
  notes: 'notas del tecnico',
  canonicalDomain: null,
  source: 'manual',
  sourceType: 'manual',
  archivedAt: null,
  scrapedSnapshot: null,
  ...overrides,
});

const state = (overrides: Partial<DatabaseState> = {}): DatabaseState => ({
  stores: [],
  items: [],
  priceRefs: new Set(),
  knownDomains: new Set(),
  dismissedDomains: new Set(),
  origin: 'test',
  ...overrides,
});

const siteResult = (overrides: Partial<SiteResult> & { site: SourceSite }): SiteResult => ({
  status: 'ok',
  company: null,
  products: [],
  pagesFetched: [],
  durationMs: 10,
  ...overrides,
});

const companyResult = (domain: string, name: string, relevanceScore = 80): SiteResult =>
  siteResult({
    site: { url: `https://${domain}`, canonicalDomain: domain, discoveryMethod: 'search' },
    company: {
      name,
      description: null,
      address: null,
      phone: null,
      email: `ventas@${domain}`,
      website: `https://${domain}`,
      canonicalDomain: domain,
      categories: ['hvac'],
      fingerprint: `fp-${domain}`,
      relevanceScore,
      sourceUrl: `https://${domain}`,
      scrapedAt: AT,
      provenance: {},
      raw: {},
    },
  });

const run = () => createRunContext({ mode: 'full', logger: silentLogger, runId: 'run-1', now: () => new Date(AT) });

describe('relevancia', () => {
  it('acepta un proveedor del rubro', () => {
    const result = scoreRelevance('Venta de insumos para aire acondicionado. Distribuidor mayorista de caneria de cobre.');
    expect(result.isRelevant).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(RELEVANCE_THRESHOLD);
  });

  it('rechaza un sitio comercial de otro rubro', () => {
    expect(scoreRelevance('Inmobiliaria: venta y alquiler de propiedades. Catalogo de departamentos.').isRelevant).toBe(false);
  });

  it('rechaza un marketplace aunque hable del rubro', () => {
    expect(scoreRelevance('MercadoLibre: aire acondicionado split, compresor, catalogo, comprar').isRelevant).toBe(false);
  });

  it('sin senal del rubro no hay caso, por mas comercio que sea', () => {
    expect(scoreRelevance('Distribuidor mayorista, lista de precios, catalogo, sucursal').isRelevant).toBe(false);
  });
});

describe('robots.txt', () => {
  it('aplica el grupo del user-agent propio antes que el de *', () => {
    const rules = parseRobots(
      ['User-agent: *', 'Disallow: /', '', 'User-agent: NossaClimaBot', 'Disallow: /admin', 'Crawl-delay: 5'].join('\n'),
      'NossaClimaBot/1.0',
    );

    expect(rules.crawlDelaySeconds).toBe(5);
    expect(isPathAllowed(rules, '/productos')).toBe(true);
    expect(isPathAllowed(rules, '/admin/x')).toBe(false);
  });

  it('cae al grupo * cuando no hay uno propio', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /privado', 'NossaClimaBot/1.0');
    expect(isPathAllowed(rules, '/privado/x')).toBe(false);
    expect(isPathAllowed(rules, '/publico')).toBe(true);
  });

  it('la regla mas larga gana y Allow desempata', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /productos\nAllow: /productos/publico', 'bot');
    expect(isPathAllowed(rules, '/productos/privado')).toBe(false);
    expect(isPathAllowed(rules, '/productos/publico')).toBe(true);
  });

  it('soporta comodines y ancla final', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /*.pdf$', 'bot');
    expect(isPathAllowed(rules, '/manual.pdf')).toBe(false);
    expect(isPathAllowed(rules, '/manual.pdf.html')).toBe(true);
  });

  it('lee los sitemaps', () => {
    expect(parseRobots('Sitemap: https://a.com.ar/sitemap.xml', 'bot').sitemaps).toEqual(['https://a.com.ar/sitemap.xml']);
  });
});

describe('rate limiter', () => {
  it('espacia los pedidos al mismo host y no a hosts distintos', async () => {
    const waits: number[] = [];
    const limiter = new RateLimiter({
      minDelayMs: 1000,
      maxConcurrent: 5,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    await limiter.run('a.com', async () => 1);
    await limiter.run('a.com', async () => 2);
    await limiter.run('b.com', async () => 3);

    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(0);
  });

  it('el crawl-delay del sitio manda si es mayor', () => {
    const limiter = new RateLimiter({ minDelayMs: 1000, maxConcurrent: 1 });
    limiter.setHostDelay('a.com', 5);
    expect(limiter.delayFor('a.com')).toBe(5000);

    limiter.setHostDelay('b.com', 0.1);
    expect(limiter.delayFor('b.com')).toBe(1000);
  });
});

describe('discovery', () => {
  const provider = (results: Array<{ url: string; title: string }>): SearchProvider => ({
    name: 'test',
    search: async () => results.map((entry) => ({ ...entry, snippet: '', query: 'q' })),
  });

  it('descarta lo que ya conocemos y lo que no es del rubro', async () => {
    const outcome = await discoverNewSites({
      provider: provider([
        { url: 'https://conocida.com.ar', title: 'Insumos aire acondicionado' },
        { url: 'https://nueva.com.ar', title: 'Distribuidora de insumos para aire acondicionado' },
        { url: 'https://inmobiliaria.com.ar', title: 'Venta de departamentos' },
      ]),
      queries: ['q'],
      knownDomains: new Set(['conocida.com.ar']),
      maxResultsPerQuery: 10,
      maxNewDomains: 10,
      logger: silentLogger,
    });

    expect(outcome.sites.map((site) => site.canonicalDomain)).toEqual(['nueva.com.ar']);
    expect(outcome.stats.alreadyKnown).toBe(1);
    expect(outcome.stats.rejectedIrrelevant).toBe(1);
  });

  it('no repite el mismo dominio dos veces', async () => {
    const outcome = await discoverNewSites({
      provider: provider([
        { url: 'https://a.com.ar/x', title: 'Insumos aire acondicionado mayorista' },
        { url: 'https://www.a.com.ar/y', title: 'Insumos aire acondicionado mayorista' },
      ]),
      queries: ['q'],
      knownDomains: new Set(),
      maxResultsPerQuery: 10,
      maxNewDomains: 10,
      logger: silentLogger,
    });

    expect(outcome.sites).toHaveLength(1);
  });

  it('respeta el tope de dominios nuevos', async () => {
    const many = Array.from({ length: 10 }, (_unused, index) => ({
      url: `https://sitio${index}.com.ar`,
      title: 'Insumos para aire acondicionado mayorista',
    }));

    const outcome = await discoverNewSites({
      provider: provider(many),
      queries: ['q'],
      knownDomains: new Set(),
      maxResultsPerQuery: 20,
      maxNewDomains: 3,
      logger: silentLogger,
    });

    expect(outcome.sites).toHaveLength(3);
  });
});

describe('archivo de candidatos', () => {
  it('acepta entradas minimas y descarta lo invalido', () => {
    const results = parseCandidatesFile('[{"url":"https://a.com.ar"},{"nada":1},{"url":""}]');
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe('https://a.com.ar');
  });

  it('no explota con JSON roto', () => {
    expect(parseCandidatesFile('{roto')).toEqual([]);
  });
});

describe('sitios del estado', () => {
  it('toma la web cargada a mano en la app', () => {
    const sites = sitesFromState(state({ stores: [store({ website: 'https://pizarro.com.ar' })] }));
    expect(sites[0]?.canonicalDomain).toBe('pizarro.com.ar');
    expect(sites[0]?.storeId).toBe('store-1');
  });

  it('ignora las archivadas y las que no tienen web', () => {
    const sites = sitesFromState(
      state({
        stores: [
          store({ id: 'a', website: null, canonicalDomain: null }),
          store({ id: 'b', website: 'https://x.com.ar', archivedAt: AT }),
        ],
      }),
    );
    expect(sites).toEqual([]);
  });

  it('mergeSites prefiere el sitio que sabe a que tienda pertenece', () => {
    const merged = mergeSites(
      [{ url: 'https://a.com.ar', canonicalDomain: 'a.com.ar', discoveryMethod: 'seed' }],
      [{ url: 'https://a.com.ar', canonicalDomain: 'a.com.ar', discoveryMethod: 'seed', storeId: 'store-1' }],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.storeId).toBe('store-1');
  });
});

describe('buildSyncPlan', () => {
  const discoveryStats = {
    provider: 'test',
    queriesRun: 1,
    resultsSeen: 1,
    domainsSeen: 1,
    alreadyKnown: 0,
    rejectedIrrelevant: 0,
    newDomains: 1,
  };

  const plan = (results: SiteResult[], dbState = state()) =>
    buildSyncPlan({ run: run(), state: dbState, siteResults: results, sources: [], discoveryStats });

  it('una empresa nueva NUNCA entra a stores: queda como candidato', () => {
    const result = plan([companyResult('nueva.com.ar', 'Distribuidora Austral')]);

    expect(result.storeUpdates).toHaveLength(0);
    expect(result.companyCandidates).toHaveLength(1);
    expect(result.companyCandidates[0]?.decision).toBe('new');
  });

  it('una empresa conocida por dominio se propone como update', () => {
    const dbState = state({ stores: [store({ canonicalDomain: 'pizarro.com.ar' })] });
    const result = plan([companyResult('pizarro.com.ar', 'Pizarro')], dbState);

    expect(result.storeUpdates).toHaveLength(1);
    expect(result.storeUpdates[0]?.changes.email).toBe('ventas@pizarro.com.ar');
    expect(result.companyCandidates[0]?.decision).toBe('update');
  });

  it('lo que no es del rubro se marca irrelevante y no llega a la cola', () => {
    const result = plan([companyResult('otra.com.ar', 'Inmobiliaria', 10)]);

    expect(result.companyCandidates[0]?.decision).toBe('irrelevant');
    expect(buildReport(result).revisionManual).toHaveLength(0);
  });

  it('un dominio descartado antes no vuelve a la cola de revision', () => {
    // Sin esto, un candidato rechazado reaparece todos los meses y la cola se
    // vuelve impracticable: descartar tiene que ser una decision que se respeta.
    const dbState = state({ dismissedDomains: new Set(['rechazada.com.ar']) });
    const result = plan([companyResult('rechazada.com.ar', 'Rechazada')], dbState);

    expect(result.companyCandidates[0]?.decision).toBe('discarded');
    expect(buildReport(result).revisionManual).toHaveLength(0);
  });

  it('dos resultados del mismo dominio se consolidan', () => {
    const result = plan([companyResult('a.com.ar', 'A'), companyResult('a.com.ar', 'A')]);

    expect(result.companyCandidates.filter((candidate) => candidate.decision === 'duplicate')).toHaveLength(1);
    expect(result.companyCandidates.filter((candidate) => candidate.decision === 'new')).toHaveLength(1);
  });

  it('un sitio fallido no genera candidatos pero si figura en el reporte', () => {
    const failed = siteResult({
      site: { url: 'https://caida.com.ar', canonicalDomain: 'caida.com.ar', discoveryMethod: 'seed' },
      status: 'failed',
      error: 'HTTP 503',
    });

    const result = plan([failed, companyResult('ok.com.ar', 'OK')]);
    const report = buildReport(result);

    expect(result.companyCandidates).toHaveLength(1);
    expect(report.summary.sitios.fallidos).toBe(1);
    expect(report.fallos[0]?.motivo).toBe('HTTP 503');
  });
});

describe('SQL', () => {
  it('escapa comillas simples', () => {
    expect(quote("Refrigeracion D'Angelo")).toBe("'Refrigeracion D''Angelo'");
    expect(quote(null)).toBe('null');
  });

  it('serializa jsonb y arrays de texto', () => {
    expect(quoteJsonb({ a: 1 })).toBe(`'{"a":1}'::jsonb`);
    expect(quoteTextArray([])).toBe(`'{}'::text[]`);
    expect(quoteTextArray(['hvac', "o'brien"])).toBe(`array['hvac', 'o''brien']::text[]`);
  });

  it('el SQL generado es idempotente y no crea tiendas', () => {
    const dbState = state({ stores: [store({ canonicalDomain: 'pizarro.com.ar' })] });
    const syncPlan = buildSyncPlan({
      run: run(),
      state: dbState,
      siteResults: [companyResult('pizarro.com.ar', 'Pizarro'), companyResult('nueva.com.ar', 'Nueva')],
      sources: [],
      discoveryStats: {
        provider: 'test',
        queriesRun: 0,
        resultsSeen: 0,
        domainsSeen: 0,
        alreadyKnown: 0,
        rejectedIrrelevant: 0,
        newDomains: 0,
      },
    });

    const sql = renderSyncSql(syncPlan, { sourceName: 'air_conditioning_scraper' });

    expect(sql).toContain('begin;');
    expect(sql).toContain('commit;');
    expect(sql).toContain('on conflict (run_id, fingerprint) do nothing');
    expect(sql).toContain('on conflict (id) do update set');

    // La unica escritura sobre stores es un UPDATE de una tienda existente.
    expect(sql).toContain('update public.stores set');
    expect(sql).not.toContain('insert into public.stores');

    // Trazabilidad obligatoria en el UPDATE.
    expect(sql).toContain('last_scraped_at');
    expect(sql).toContain('scraped_snapshot');
    expect(sql).toContain('source_url');
  });

  it('el UPDATE no cambia el origen de una tienda cargada a mano', () => {
    const dbState = state({ stores: [store({ canonicalDomain: 'pizarro.com.ar' })] });
    const syncPlan = buildSyncPlan({
      run: run(),
      state: dbState,
      siteResults: [companyResult('pizarro.com.ar', 'Pizarro')],
      sources: [],
      discoveryStats: {
        provider: 'test',
        queriesRun: 0,
        resultsSeen: 0,
        domainsSeen: 0,
        alreadyKnown: 0,
        rejectedIrrelevant: 0,
        newDomains: 0,
      },
    });

    const updateBlock = renderSyncSql(syncPlan, { sourceName: 'air_conditioning_scraper' })
      .split('update public.stores set')[1]
      ?.split(';')[0];

    // La fila la creo una persona: sigue siendo suya.
    expect(updateBlock).not.toContain('source_type =');
    expect(updateBlock).not.toMatch(/\bsource =/);
  });
});

describe('reporte', () => {
  it('cuenta lo que hay que saber y lista lo que requiere revision', () => {
    const dbState = state({ stores: [store({ canonicalDomain: 'pizarro.com.ar' })] });
    const syncPlan = buildSyncPlan({
      run: run(),
      state: dbState,
      siteResults: [companyResult('pizarro.com.ar', 'Pizarro'), companyResult('nueva.com.ar', 'Nueva')],
      sources: [],
      discoveryStats: {
        provider: 'file',
        queriesRun: 1,
        resultsSeen: 2,
        domainsSeen: 2,
        alreadyKnown: 1,
        rejectedIrrelevant: 0,
        newDomains: 1,
      },
    });

    const report = buildReport(syncPlan);

    expect(report.summary.sitios.total).toBe(2);
    expect(report.summary.empresas.actualizadas).toBe(1);
    expect(report.summary.empresas.nuevas).toBe(1);
    expect(report.revisionManual).toHaveLength(1);
    expect(report.revisionManual[0]?.tipo).toBe('empresa');

    // Cada item de revision dice de que URL salio.
    expect(report.revisionManual[0]?.fuente).toBe('https://nueva.com.ar');

    const markdown = renderMarkdown(report);
    expect(markdown).toContain('Requieren revision manual');
    expect(markdown).toContain('nueva.com.ar');
  });
});
