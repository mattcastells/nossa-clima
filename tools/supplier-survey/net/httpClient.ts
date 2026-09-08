/**
 * Cliente HTTP del relevamiento.
 *
 * Todo pedido sale por aca, y por aca pasa el rate limit, el robots.txt, el
 * timeout, el reintento y la cache condicional. Nunca tira: devuelve un
 * `FetchOutcome`. El pipeline procesa 40 sitios y el fallo de uno no puede
 * frenar los otros 39.
 */

import type { FetchOutcome } from '../core/types.ts';
import type { Logger } from '../core/logger.ts';
import { HttpCache, hashContent, type CacheEntry } from './cache.ts';
import { RateLimiter } from './rateLimiter.ts';
import { RobotsCache } from './robots.ts';

export interface HttpClientOptions {
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  maxBodyBytes: number;
  cache: HttpCache;
  rateLimiter: RateLimiter;
  logger: Logger;
  /** Inyectable para tests. */
  fetchImpl?: typeof fetch;
  respectRobots?: boolean;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const HTML_CONTENT_TYPE = /(text\/html|application\/xhtml|text\/plain|application\/json)/i;

export class HttpClient {
  private readonly robots: RobotsCache;
  private readonly fetchImpl: typeof fetch;
  private readonly respectRobots: boolean;

  private readonly options: HttpClientOptions;

  constructor(options: HttpClientOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.respectRobots = options.respectRobots ?? true;
    this.robots = new RobotsCache(options.userAgent, async (robotsUrl) => {
      const response = await this.rawFetch(robotsUrl, {});
      if (!response) return null;
      return { status: response.status, body: await this.readBody(response) };
    });
  }

  /**
   * Descarga una pagina. Devuelve `not-modified` si el sitio confirma que no
   * cambio, y `skipped` si robots.txt lo prohibe o el contenido es identico al
   * de la corrida anterior.
   */
  async fetchPage(url: string, { force = false }: { force?: boolean } = {}): Promise<FetchOutcome> {
    let host: string;
    try {
      host = new URL(url).host;
    } catch {
      return { kind: 'error', url, message: 'URL invalida' };
    }

    if (this.respectRobots) {
      const { allowed, crawlDelaySeconds } = await this.robots.isAllowed(url);
      if (crawlDelaySeconds !== null) this.options.rateLimiter.setHostDelay(host, crawlDelaySeconds);

      if (!allowed) {
        this.options.logger.debug(`robots.txt no permite ${url}`);
        return { kind: 'skipped', reason: 'robots', url };
      }
    }

    const cached = force ? null : await this.options.cache.get(url);
    const headers = force ? {} : this.options.cache.conditionalHeaders(cached);

    return this.options.rateLimiter.run(host, async () => {
      const response = await this.withRetries(url, headers);
      if ('error' in response) return { kind: 'error', url, message: response.error };

      if (response.value.status === 304 && cached) {
        this.options.logger.debug(`304 sin cambios: ${url}`);
        return { kind: 'not-modified', status: 304, url };
      }

      if (response.value.status >= 400) {
        return { kind: 'error', url, status: response.value.status, message: `HTTP ${response.value.status}` };
      }

      const contentType = response.value.headers.get('content-type') ?? '';
      if (contentType && !HTML_CONTENT_TYPE.test(contentType)) {
        return { kind: 'error', url, status: response.value.status, message: `Tipo no procesable: ${contentType}` };
      }

      const body = await this.readBody(response.value);
      const contentHash = hashContent(body);

      const entry: CacheEntry = {
        url,
        etag: response.value.headers.get('etag'),
        lastModified: response.value.headers.get('last-modified'),
        contentHash,
        status: response.value.status,
        fetchedAt: new Date().toISOString(),
        body,
      };
      await this.options.cache.set(entry);

      // El servidor no soporta condicionales pero el contenido es el mismo.
      if (!force && cached && cached.contentHash === contentHash) {
        return { kind: 'skipped', reason: 'unchanged', url };
      }

      return { kind: 'ok', status: response.value.status, url, html: body, fromCache: false };
    });
  }

  /** Lee el cuerpo guardado de una URL sin salir a la red. */
  async cachedBody(url: string): Promise<string | null> {
    const entry = await this.options.cache.get(url);
    return entry?.body ?? null;
  }

  private async withRetries(
    url: string,
    headers: Record<string, string>,
  ): Promise<{ value: Response } | { error: string }> {
    let lastError = 'sin respuesta';

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      if (attempt > 0) {
        // Backoff exponencial con tope: 1s, 2s, 4s...
        const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
        await new Promise((resolve) => setTimeout(resolve, wait));
        this.options.logger.debug(`reintento ${attempt} de ${url}`);
      }

      const response = await this.rawFetch(url, headers);
      if (!response) {
        lastError = 'fallo de red o timeout';
        continue;
      }

      if (!RETRYABLE_STATUS.has(response.status)) return { value: response };

      lastError = `HTTP ${response.status}`;

      // 429 con Retry-After: el sitio nos dice cuanto esperar. Le hacemos caso.
      const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
      if (Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 60) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      }
    }

    return { error: lastError };
  }

  private async rawFetch(url: string, headers: Record<string, string>): Promise<Response | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      return await this.fetchImpl(url, {
        headers: {
          'User-Agent': this.options.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-AR,es;q=0.9',
          ...headers,
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Corta el cuerpo si el sitio manda algo desmesurado. */
  private async readBody(response: Response): Promise<string> {
    const text = await response.text();
    return text.length > this.options.maxBodyBytes ? text.slice(0, this.options.maxBodyBytes) : text;
  }
}
