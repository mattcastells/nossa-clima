import { createHash } from 'node:crypto';

import { companyNameKey } from '../normalize/text.ts';

/** sha256 hex acortado: 16 bytes alcanzan y entran comodos en un log. */
const digest = (parts: Array<string | number | null>): string =>
  createHash('sha256').update(parts.map((part) => String(part ?? '')).join('|')).digest('hex').slice(0, 32);

/**
 * Huella de una empresa. Dominio + nombre normalizado.
 *
 * El dominio solo no alcanza: una distribuidora puede publicar dos sucursales
 * en el mismo sitio. El nombre solo tampoco: hay cinco "Frio Sur" en el pais.
 * Juntos identifican la fila que queremos deduplicar entre corridas.
 */
export const companyFingerprint = (canonicalDomain: string, name: string | null): string =>
  digest(['company', canonicalDomain, companyNameKey(name)]);

/**
 * Huella de una observacion de precio.
 *
 * Incluye el precio a proposito: si el sitio publica otro precio, la huella
 * cambia y entra una observacion nueva, que es exactamente lo que queremos en
 * una tabla que es un historico. Si el precio no cambio, la huella se repite y
 * el insert no hace nada.
 */
export const priceObservationRef = (
  canonicalDomain: string,
  productKey: string,
  price: number,
  currency: string,
): string => digest(['price', canonicalDomain, productKey, price.toFixed(2), currency]);

/**
 * Clave estable de un producto dentro de un sitio.
 * El SKU manda cuando existe; si no, el nombre normalizado.
 */
export const productKey = (name: string, sku: string | null): string => {
  if (sku && sku.trim().length > 0) return `sku:${sku.trim().toLowerCase()}`;
  return `name:${companyNameKey(name)}`;
};
