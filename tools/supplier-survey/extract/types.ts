import type { RawCompany, RawProduct } from '../core/types.ts';

/**
 * Una pagina ya descargada y pre-digerida.
 *
 * El parseo caro (texto visible, meta tags, JSON-LD) se hace una sola vez y lo
 * comparten todas las estrategias, en vez de que cada una vuelva a recorrer el
 * HTML entero.
 */
export interface PageContext {
  url: string;
  html: string;
  text: string;
  metaTags: Record<string, string>;
  jsonLdNodes: Array<Record<string, unknown>>;
  scrapedAt: string;
}

/**
 * Contrato de una estrategia de extraccion.
 *
 * Agregar soporte para un tipo de sitio nuevo es escribir una de estas y
 * sumarla al registry. Ninguna otra capa cambia.
 */
export interface ExtractionStrategy<TResult> {
  /** Identificador que queda grabado en la procedencia de cada campo. */
  readonly name: string;
  /**
   * Cuanto confiamos en lo que devuelve esta estrategia, 0..1.
   * Cuando dos estrategias dan valores distintos para el mismo campo, gana la
   * de confianza mas alta. Ver CONFIDENCE en registry.ts.
   */
  readonly confidence: number;
  /** Chequeo barato: ¿tiene sentido correr esta estrategia en esta pagina? */
  canHandle(page: PageContext): boolean;
  extract(page: PageContext): TResult;
}

export type CompanyStrategy = ExtractionStrategy<RawCompany>;
export type ProductStrategy = ExtractionStrategy<RawProduct[]>;
