/**
 * Cache HTTP en disco.
 *
 * Es lo que hace que "evitar requests innecesarios" sea real: guardamos el
 * ETag y el Last-Modified de cada URL, y en la corrida siguiente mandamos el
 * pedido condicional. Si el sitio contesta 304 no bajamos el HTML de nuevo, y
 * si el `contentHash` coincide sabemos que no hay nada que reprocesar aunque
 * el servidor no soporte condicionales.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface CacheEntry {
  url: string;
  etag: string | null;
  lastModified: string | null;
  contentHash: string;
  status: number;
  fetchedAt: string;
  /** Cuerpo guardado, para poder reprocesar sin volver a pedir. */
  body: string;
}

export const hashContent = (body: string): string =>
  createHash('sha256').update(body).digest('hex').slice(0, 32);

const keyFor = (url: string): string => createHash('sha256').update(url).digest('hex').slice(0, 40);

export class HttpCache {
  // Campos declarados y asignados a mano: Node ejecuta estos .ts borrando los
  // tipos, y en ese modo las parameter properties no existen.
  protected readonly directory: string;

  constructor(directory: string) {
    this.directory = directory;
  }

  private fileFor(url: string): string {
    return path.join(this.directory, `${keyFor(url)}.json`);
  }

  async get(url: string): Promise<CacheEntry | null> {
    try {
      const content = await readFile(this.fileFor(url), 'utf8');
      const parsed: unknown = JSON.parse(content);

      if (parsed === null || typeof parsed !== 'object') return null;
      const entry = parsed as Partial<CacheEntry>;
      if (typeof entry.url !== 'string' || typeof entry.body !== 'string') return null;

      return {
        url: entry.url,
        etag: entry.etag ?? null,
        lastModified: entry.lastModified ?? null,
        contentHash: entry.contentHash ?? hashContent(entry.body),
        status: entry.status ?? 200,
        fetchedAt: entry.fetchedAt ?? new Date(0).toISOString(),
        body: entry.body,
      };
    } catch {
      return null;
    }
  }

  async set(entry: CacheEntry): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    await writeFile(this.fileFor(entry.url), JSON.stringify(entry, null, 2), 'utf8');
  }

  /** Cabeceras condicionales para no volver a bajar lo mismo. */
  conditionalHeaders(entry: CacheEntry | null): Record<string, string> {
    if (!entry) return {};

    const headers: Record<string, string> = {};
    if (entry.etag) headers['If-None-Match'] = entry.etag;
    if (entry.lastModified) headers['If-Modified-Since'] = entry.lastModified;

    return headers;
  }
}

/** Cache en memoria, para los tests y para `--no-cache`. */
export class MemoryCache extends HttpCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor() {
    super('');
  }

  override async get(url: string): Promise<CacheEntry | null> {
    return this.entries.get(url) ?? null;
  }

  override async set(entry: CacheEntry): Promise<void> {
    this.entries.set(entry.url, entry);
  }
}
