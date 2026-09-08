/**
 * Discovery desde un archivo de candidatos.
 *
 * Es el proveedor por defecto y el unico que funciona sin API key ni costo.
 * El archivo lo llena una persona o el skill de Claude (que si tiene busqueda
 * web): pega ahi las URLs que encontro y el pipeline las procesa igual que a
 * cualquier otro resultado, con el mismo filtro de relevancia y la misma
 * deduplicacion.
 *
 * Formato de `seeds/candidates.json`:
 *   [{ "url": "https://ejemplo.com.ar", "title": "...", "snippet": "...", "query": "..." }]
 * Alcanza con `url`.
 */

import { readFile } from 'node:fs/promises';

import type { SearchProvider, SearchResult } from '../provider.ts';

interface RawCandidate {
  url?: unknown;
  title?: unknown;
  snippet?: unknown;
  note?: unknown;
  query?: unknown;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const parseCandidatesFile = (content: string): SearchResult[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  const entries = Array.isArray(parsed) ? parsed : [];
  const results: SearchResult[] = [];

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue;

    const candidate = entry as RawCandidate;
    const url = asText(candidate.url);
    if (url.length === 0) continue;

    results.push({
      url,
      title: asText(candidate.title),
      snippet: asText(candidate.snippet) || asText(candidate.note),
      query: asText(candidate.query) || 'archivo de candidatos',
    });
  }

  return results;
};

/**
 * Devuelve el archivo entero en la primera consulta y nada despues: las URLs
 * de un archivo no dependen de la query, y repetirlas por cada una solo
 * inflaria el reporte.
 */
export const createFileProvider = (filePath: string): SearchProvider => {
  let delivered = false;

  return {
    name: 'file',
    search: async (_query, limit) => {
      if (delivered) return [];
      delivered = true;

      try {
        const content = await readFile(filePath, 'utf8');
        return parseCandidatesFile(content).slice(0, Math.max(limit, 100));
      } catch {
        return [];
      }
    },
  };
};
