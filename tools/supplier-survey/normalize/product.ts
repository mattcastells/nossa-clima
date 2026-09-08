/**
 * De `RawProduct` a `NormalizedProduct`.
 *
 * Un producto sin precio igual se guarda: sirve para saber que vende cada
 * tienda aunque el precio este detras de un login mayorista, que en este rubro
 * es lo habitual.
 */

import type { NormalizedProduct, RawProduct } from '../core/types.ts';
import { priceObservationRef, productKey } from '../dedupe/fingerprint.ts';
import { parsePresentation } from './price.ts';
import { cleanText, truncate } from './text.ts';

const LIMITS = { name: 160, brand: 80, sku: 60, category: 80 } as const;

/** Moneda que aceptamos guardar. Otra cosa es un error de parseo. */
const KNOWN_CURRENCIES = new Set(['ARS', 'USD', 'EUR', 'BRL', 'UYU']);

export interface NormalizeProductInput {
  raw: RawProduct;
  canonicalDomain: string;
  sourceUrl: string;
  scrapedAt: string;
}

export const normalizeProduct = ({
  raw,
  canonicalDomain,
  sourceUrl,
  scrapedAt,
}: NormalizeProductInput): NormalizedProduct | null => {
  const rawName = cleanText(raw.name.value);
  if (!rawName || rawName.length < 3) return null;

  const name = truncate(rawName, LIMITS.name);

  const brandText = cleanText(raw.brand?.value);
  const brand = brandText ? truncate(brandText, LIMITS.brand) : null;

  const skuText = cleanText(raw.sku?.value);
  const sku = skuText ? truncate(skuText, LIMITS.sku) : null;

  const categoryText = cleanText(raw.category?.value);
  const category = categoryText ? truncate(categoryText, LIMITS.category) : null;

  const price = raw.price?.value ?? null;
  const rawCurrency = cleanText(raw.currency?.value)?.toUpperCase() ?? 'ARS';
  const currency = KNOWN_CURRENCIES.has(rawCurrency) ? rawCurrency : 'ARS';

  // La presentacion sale del nombre: "Cano de cobre 1/4 rollo x 15 m".
  const presentation = parsePresentation(name);

  const key = productKey(name, sku);

  return {
    name,
    brand,
    sku,
    category,
    unit: cleanText(raw.unit?.value) ?? presentation?.unit ?? null,
    presentationQuantity: presentation?.quantity ?? null,
    presentationUnit: presentation?.unit ?? null,
    price,
    currency,
    availability: cleanText(raw.availability?.value),
    canonicalDomain,
    // Sin precio la huella igual tiene que ser estable, para no duplicar el
    // candidato de producto en cada corrida: usamos 0 como marcador.
    externalRef: priceObservationRef(canonicalDomain, key, price ?? 0, currency),
    sourceUrl,
    scrapedAt,
  };
};

/**
 * Quita repetidos dentro de una misma corrida. Un listado suele emitir el
 * mismo producto en el carrusel de destacados y en la grilla.
 */
export const dedupeProducts = (products: readonly NormalizedProduct[]): NormalizedProduct[] => {
  const byRef = new Map<string, NormalizedProduct>();

  for (const product of products) {
    const existing = byRef.get(product.externalRef);
    // Ante repetido, gana el que tiene precio.
    if (!existing || (existing.price === null && product.price !== null)) byRef.set(product.externalRef, product);
  }

  return [...byRef.values()];
};
