import { describe, expect, it } from 'vitest';

import { DEFAULT_CONFIG } from '../config.ts';
import { silentLogger } from '../core/logger.ts';
import type { SourceSite } from '../core/types.ts';
import { scrapeSite } from '../extract/scrapeSite.ts';
import { MemoryCache } from '../net/cache.ts';
import { HttpClient } from '../net/httpClient.ts';
import { RateLimiter } from '../net/rateLimiter.ts';

const AT = '2026-09-08T12:00:00.000Z';

const SITE: SourceSite = {
  url: 'https://friosur.com.ar/',
  canonicalDomain: 'friosur.com.ar',
  discoveryMethod: 'seed',
};

const HOME = `
<html><head>
  <title>Frio Sur | Insumos para aire acondicionado</title>
  <meta property="og:site_name" content="Frio Sur">
  <meta name="description" content="Distribuidor mayorista de insumos para aire acondicionado y refrigeracion.">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Store","name":"Frio Sur","url":"https://friosur.com.ar",
   "telephone":"+54 11 4571-2411"}
  </script>
</head><body>
  <h1>Frio Sur</h1>
  <p>Venta de insumos para aire acondicionado: caneria de cobre, gas refrigerante R410A, compresores.</p>
  <a href="/contacto">Contacto</a>
  <a href="/productos">Productos</a>
  <a href="https://instagram.com/friosur">Instagram</a>
</body></html>`;

const CONTACTO = `
<html><head><title>Contacto - Frio Sur</title></head><body>
  <p>Direccion: Av. Rivadavia 2300, CABA</p>
  <p>Escribinos a <a href="mailto:ventas@friosur.com.ar">ventas@friosur.com.ar</a></p>
</body></html>`;

const PRODUCTOS = `
<html><head><title>Productos - Frio Sur</title></head><body>
  <script type="application/ld+json">
  [{"@type":"Product","name":"Cano de cobre 1/4 rollo x 15 m","sku":"CU-14-15",
    "offers":{"@type":"Offer","price":"125400.50","priceCurrency":"ARS"}},
   {"@type":"Product","name":"Gas refrigerante R410A 11 kg",
    "offers":{"@type":"Offer","price":"180000","priceCurrency":"ARS"}}]
  </script>
</body></html>`;

interface FakeSiteOptions {
  robots?: string;
  pages?: Record<string, string>;
  status?: Record<string, number>;
  onRequest?: (url: string) => void;
}

/** fetch falso con robots.txt y unas pocas paginas. */
const fakeFetch = ({ robots = '', pages = {}, status = {}, onRequest }: FakeSiteOptions): typeof fetch =>
  (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    onRequest?.(url);

    if (url.endsWith('/robots.txt')) {
      return new Response(robots, { status: 200, headers: { 'content-type': 'text/plain' } });
    }

    const code = status[url];
    if (code !== undefined && code >= 400) return new Response('', { status: code });

    const body = pages[url];
    if (body === undefined) return new Response('No encontrado', { status: 404 });

    return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }) as typeof fetch;

const buildClient = (fetchImpl: typeof fetch): HttpClient =>
  new HttpClient({
    userAgent: 'NossaClimaBot/1.0 (test)',
    timeoutMs: 1000,
    maxRetries: 0,
    maxBodyBytes: 1_000_000,
    cache: new MemoryCache(),
    // Sin espera: el espaciado real ya se prueba en pipeline.test.ts.
    rateLimiter: new RateLimiter({ minDelayMs: 0, maxConcurrent: 4 }),
    logger: silentLogger,
    fetchImpl,
  });

const run = (fetchImpl: typeof fetch, site: SourceSite = SITE) =>
  scrapeSite({ site, client: buildClient(fetchImpl), config: DEFAULT_CONFIG, scrapedAt: AT, logger: silentLogger });

describe('scrapeSite', () => {
  const pages = {
    'https://friosur.com.ar/': HOME,
    'https://friosur.com.ar/contacto': CONTACTO,
    'https://friosur.com.ar/productos': PRODUCTOS,
  };

  it('arma la empresa juntando home y pagina de contacto', async () => {
    const result = await run(fakeFetch({ pages }));

    expect(result.status).toBe('ok');
    expect(result.company?.name).toBe('Frio Sur');
    // El telefono sale del JSON-LD de la home...
    expect(result.company?.phone).toBe('11 4571-2411');
    // ...y la direccion y el mail, de la pagina de contacto.
    expect(result.company?.address).toContain('Rivadavia 2300');
    expect(result.company?.email).toBe('ventas@friosur.com.ar');
    expect(result.company?.canonicalDomain).toBe('friosur.com.ar');
  });

  it('puntua la relevancia con el contenido real de la pagina', async () => {
    const result = await run(fakeFetch({ pages }));
    expect(result.company?.relevanceScore).toBeGreaterThanOrEqual(50);
  });

  it('extrae los productos con precio y presentacion', async () => {
    const result = await run(fakeFetch({ pages }));

    expect(result.products).toHaveLength(2);

    const cobre = result.products.find((product) => product.sku === 'CU-14-15');
    expect(cobre?.price).toBe(125400.5);
    expect(cobre?.currency).toBe('ARS');
    expect(cobre?.presentationQuantity).toBe(15);
    expect(cobre?.presentationUnit).toBe('m');
    expect(cobre?.sourceUrl).toBe('https://friosur.com.ar/productos');
  });

  it('no sale del dominio: ignora el enlace a Instagram', async () => {
    const requested: string[] = [];
    await run(fakeFetch({ pages, onRequest: (url) => requested.push(url) }));

    expect(requested.some((url) => url.includes('instagram.com'))).toBe(false);
  });

  it('respeta el tope de paginas por sitio', async () => {
    const requested: string[] = [];
    await run(fakeFetch({ pages, onRequest: (url) => requested.push(url) }));

    const nonRobots = requested.filter((url) => !url.endsWith('/robots.txt'));
    expect(nonRobots.length).toBeLessThanOrEqual(DEFAULT_CONFIG.maxPagesPerSite);
  });

  it('respeta robots.txt y no releva nada', async () => {
    const result = await run(fakeFetch({ robots: 'User-agent: *\nDisallow: /', pages }));

    expect(result.status).toBe('skipped');
    expect(result.skipReason).toContain('robots');
    expect(result.company).toBeNull();
  });

  it('sigue relevando la home aunque robots bloquee solo el catalogo', async () => {
    const requested: string[] = [];
    const result = await run(
      fakeFetch({
        robots: 'User-agent: *\nDisallow: /productos',
        pages,
        onRequest: (url) => requested.push(url),
      }),
    );

    expect(result.status).toBe('ok');
    expect(result.company?.name).toBe('Frio Sur');
    expect(requested).not.toContain('https://friosur.com.ar/productos');
  });

  it('un sitio caido queda como failed y no tira', async () => {
    const result = await run(fakeFetch({ pages, status: { 'https://friosur.com.ar/': 503 } }));

    expect(result.status).toBe('failed');
    expect(result.error).toContain('503');
    expect(result.company).toBeNull();
  });

  it('un fetch que explota queda como failed', async () => {
    const explosive = (async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;

    const result = await run(explosive);
    expect(result.status).toBe('failed');
  });

  it('una home sin datos utilizables no inventa una empresa', async () => {
    const result = await run(fakeFetch({ pages: { 'https://friosur.com.ar/': '<html><body></body></html>' } }));

    expect(result.status).toBe('failed');
    expect(result.company).toBeNull();
  });

  it('la segunda corrida detecta que el sitio no cambio', async () => {
    const client = buildClient(fakeFetch({ pages }));
    const options = { site: SITE, client, config: DEFAULT_CONFIG, scrapedAt: AT, logger: silentLogger };

    const first = await scrapeSite(options);
    expect(first.status).toBe('ok');

    // Mismo contenido, mismo hash: no hay nada que reprocesar.
    const second = await scrapeSite(options);
    expect(second.status).toBe('unchanged');
  });

  it('con --force vuelve a relevar aunque no haya cambios', async () => {
    const client = buildClient(fakeFetch({ pages }));
    const options = { site: SITE, client, config: DEFAULT_CONFIG, scrapedAt: AT, logger: silentLogger };

    await scrapeSite(options);
    const forced = await scrapeSite({ ...options, force: true });

    expect(forced.status).toBe('ok');
  });
});
