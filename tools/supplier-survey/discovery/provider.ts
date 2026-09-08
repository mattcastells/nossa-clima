/**
 * Contrato del buscador.
 *
 * El discovery no sabe de donde salen los resultados. Hoy hay tres
 * implementaciones (archivo, Serper, Brave) y agregar una cuarta —Google
 * Places, un directorio B2B, lo que sea— es escribir una de estas.
 */

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  /** Consulta que trajo este resultado, para poder explicar de donde salio. */
  query: string;
}

export interface SearchProvider {
  readonly name: string;
  /** Nunca tira: un buscador caido degrada el discovery, no rompe la corrida. */
  search(query: string, limit: number): Promise<SearchResult[]>;
}

/** Proveedor nulo: deja el discovery apagado sin ramas especiales en el pipeline. */
export const noopProvider: SearchProvider = {
  name: 'none',
  search: async () => [],
};
