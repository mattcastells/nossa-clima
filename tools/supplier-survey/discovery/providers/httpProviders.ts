/**
 * Buscadores por API. Se activan solo si hay key en el entorno.
 *
 *   SERPER_API_KEY        -> serper.dev (resultados de Google)
 *   BRAVE_SEARCH_API_KEY  -> Brave Search API
 *
 * Ninguno es obligatorio: sin key el discovery cae al proveedor de archivo.
 */

import type { Logger } from '../../core/logger.ts';
import type { SearchProvider, SearchResult } from '../provider.ts';

interface HttpProviderOptions {
  apiKey: string;
  country: string;
  language: string;
  logger: Logger;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const requestJson = async (
  url: string,
  init: RequestInit,
  { fetchImpl = fetch, timeoutMs = 15_000 }: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<unknown | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

/** Resultados de Google via serper.dev. */
export const createSerperProvider = ({
  apiKey,
  country,
  language,
  logger,
  fetchImpl,
  timeoutMs,
}: HttpProviderOptions): SearchProvider => ({
  name: 'serper',

  search: async (query, limit) => {
    const payload = await requestJson(
      'https://google.serper.dev/search',
      {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, gl: country, hl: language, num: limit }),
      },
      { ...(fetchImpl ? { fetchImpl } : {}), ...(timeoutMs ? { timeoutMs } : {}) },
    );

    if (payload === null || typeof payload !== 'object') {
      logger.warn(`serper no devolvio resultados para "${query}"`);
      return [];
    }

    const organic = (payload as { organic?: unknown }).organic;
    if (!Array.isArray(organic)) return [];

    const results: SearchResult[] = [];
    for (const entry of organic.slice(0, limit)) {
      if (entry === null || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;
      const url = asText(item.link);
      if (url.length === 0) continue;

      results.push({ url, title: asText(item.title), snippet: asText(item.snippet), query });
    }

    return results;
  },
});

/** Brave Search API. Tiene tier gratuito, util para probar el flujo. */
export const createBraveProvider = ({
  apiKey,
  country,
  language,
  logger,
  fetchImpl,
  timeoutMs,
}: HttpProviderOptions): SearchProvider => ({
  name: 'brave',

  search: async (query, limit) => {
    const params = new URLSearchParams({
      q: query,
      country: country.toUpperCase(),
      search_lang: language,
      count: String(limit),
    });

    const payload = await requestJson(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } },
      { ...(fetchImpl ? { fetchImpl } : {}), ...(timeoutMs ? { timeoutMs } : {}) },
    );

    if (payload === null || typeof payload !== 'object') {
      logger.warn(`brave no devolvio resultados para "${query}"`);
      return [];
    }

    const web = (payload as { web?: { results?: unknown } }).web;
    if (!web || !Array.isArray(web.results)) return [];

    const results: SearchResult[] = [];
    for (const entry of web.results.slice(0, limit)) {
      if (entry === null || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;
      const url = asText(item.url);
      if (url.length === 0) continue;

      results.push({ url, title: asText(item.title), snippet: asText(item.description), query });
    }

    return results;
  },
});
