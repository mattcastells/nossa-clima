/**
 * UUID deterministicos (v5).
 *
 * Las filas nuevas necesitan id antes de existir en la base, porque los precios
 * referencian a la tienda y al item. Si el id saliera de `gen_random_uuid()`,
 * reimportar la planilla crearia todo de nuevo.
 *
 * Con v5 el id se deriva del contenido: la misma tienda da siempre el mismo
 * uuid, y `on conflict (id) do nothing` alcanza para que el import sea
 * idempotente sin depender de indices unicos por nombre.
 */

import { createHash } from 'node:crypto';

/** Namespace propio del relevamiento. Fijo: cambiarlo re-crea todo. */
const NAMESPACE = 'f7b3a1c0-5d2e-4a91-8c6f-1e0b7d4a9c33';

const namespaceBytes = (): Buffer => Buffer.from(NAMESPACE.replace(/-/g, ''), 'hex');

export const deterministicUuid = (kind: string, key: string): string => {
  const hash = createHash('sha1').update(namespaceBytes()).update(`${kind}:${key}`, 'utf8').digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  // Version 5 y variante RFC 4122.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Id de una tienda importada. El dominio es su identidad. */
export const storeUuid = (canonicalDomain: string): string => deterministicUuid('store', canonicalDomain);

/**
 * Id de un material importado.
 * La variante entra en la clave: "por metro" y "rollo 15 m" son dos items,
 * porque se compran distinto y se comparan entre si por separado.
 */
export const itemUuid = (itemKey: string): string => deterministicUuid('item', itemKey);
