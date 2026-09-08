/**
 * ¿Esta empresa scrapeada es alguna de las que ya tenemos?
 *
 * Cascada de senales, de la mas fuerte a la mas debil. La primera que da
 * certeza corta: no hay razon para seguir comparando nombres si el dominio ya
 * coincide.
 *
 *   dominio          100  no hay dos empresas con el mismo dominio
 *   telefono          90  practicamente identidad; puede fallar en franquicias
 *   direccion+nombre  88  misma calle, misma altura y el nombre acompana
 *   nombre + calle    80  la calle desambigua los homonimos
 *   direccion sola    75  mismo local, nombre distinto: lo mira una persona
 *   nombre exacto     65  suficiente para revisar, no para aplicar solo
 *   nombre parecido   40..64  siempre a revision manual
 *
 * La direccion importa mas de lo que parece: "Refrigeracion Pizarro" y
 * "Pizarro" solo se parecen 0,52 como nombres, pero estan en la misma altura
 * de la misma avenida. Sin esta senal se crea un duplicado.
 */

import type { ItemState, NormalizedCompany, NormalizedProduct, StoreState } from '../core/types.ts';
import { compareMeasures, materialWords } from '../normalize/material.ts';
import { phoneKeys } from '../normalize/phone.ts';
import { companyNameKey, foldAccents } from '../normalize/text.ts';
import { unitsMatch } from '../normalize/unit.ts';
import { jaroWinkler, nameSimilarity, tokenOverlap } from './similarity.ts';

export interface MatchResult {
  storeId: string | null;
  confidence: number;
  reason: string;
}

/** Desde aca se considera la misma empresa y se propone actualizar. */
export const AUTO_MATCH_THRESHOLD = 80;
/** Debajo de esto ni se ofrece como posible duplicado. */
export const REVIEW_MATCH_THRESHOLD = 40;

/** Numero de calle de una direccion, que es la parte que desambigua. */
const streetNumber = (address: string | null): string | null => {
  if (!address) return null;
  const match = address.match(/\b(\d{1,5})\b/);
  return match?.[1] ?? null;
};

/**
 * Palabras de la calle, sin el tipo de via ni la localidad ni el numero.
 * "Av. de los Constituyentes 3729, CABA" -> "constituyentes"
 */
const STREET_NOISE = new Set([
  'av',
  'avda',
  'avenida',
  'calle',
  'ruta',
  'pasaje',
  'diagonal',
  'blvd',
  'boulevard',
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'y',
  'caba',
  'capital',
  'federal',
  'buenos',
  'aires',
  'bs',
  'as',
  'gba',
  'piso',
  'local',
  'depto',
  'oeste',
  'este',
  'norte',
  'sur',
]);

const streetTokens = (address: string | null): string => {
  if (!address) return '';

  // Nos quedamos con el primer tramo: despues de la coma suele venir la localidad.
  const head = address.split(',')[0] ?? address;

  return foldAccents(head)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !/^\d+$/.test(token) && !STREET_NOISE.has(token))
    .join(' ');
};

/**
 * ¿Es el mismo local? Misma altura y calles que se parecen lo suficiente.
 * Exige el numero: "Buenos Aires" sin altura no identifica nada.
 */
const isSameAddress = (a: string | null, b: string | null): boolean => {
  const numberA = streetNumber(a);
  const numberB = streetNumber(b);
  if (numberA === null || numberA !== numberB) return false;

  const streetA = streetTokens(a);
  const streetB = streetTokens(b);
  if (streetA.length === 0 || streetB.length === 0) return false;

  return tokenOverlap(streetA, streetB) >= 0.6;
};

export const matchCompany = (company: NormalizedCompany, stores: readonly StoreState[]): MatchResult => {
  const active = stores.filter((store) => store.archivedAt === null);

  // 1. Dominio.
  const byDomain = active.find((store) => store.canonicalDomain === company.canonicalDomain);
  if (byDomain) return { storeId: byDomain.id, confidence: 100, reason: 'mismo dominio' };

  // 2. Telefono. Un campo puede traer varios numeros separados por barra.
  const incomingPhones = new Set(phoneKeys(company.phone));
  if (incomingPhones.size > 0) {
    const byPhone = active.find((store) => phoneKeys(store.phone).some((key) => incomingPhones.has(key)));
    if (byPhone) return { storeId: byPhone.id, confidence: 90, reason: 'mismo telefono' };
  }

  // 3 en adelante: direccion y nombre, que se refuerzan entre si.
  const incomingName = companyNameKey(company.name);
  if (incomingName.length < 3) return { storeId: null, confidence: 0, reason: 'sin nombre comparable' };

  let best: MatchResult = { storeId: null, confidence: 0, reason: 'sin coincidencias' };

  for (const store of active) {
    const storeName = companyNameKey(store.name);
    if (storeName.length < 3) continue;

    const similarity = nameSimilarity(incomingName, storeName);
    const sameAddress = isSameAddress(company.address, store.address);

    // Para corroborar una direccion pedimos una palabra compartida, no
    // similitud de caracteres: "distribuidora austral" y "ferreteria central"
    // comparten muchas letras y ninguna palabra. No son la misma empresa.
    const sharedWords = tokenOverlap(incomingName, storeName);

    let confidence = 0;
    let reason = '';

    if (sameAddress && sharedWords >= 0.3) {
      confidence = 88;
      reason = `misma direccion y nombre compatible (${similarity.toFixed(2)})`;
    } else if (sameAddress) {
      // Mismo local, nombre distinto: puede ser un cambio de razon social o
      // dos comercios en la misma galeria. Lo decide una persona.
      confidence = 75;
      reason = `misma direccion, nombre distinto (${similarity.toFixed(2)})`;
    } else if (similarity >= 0.99) {
      confidence = 65;
      reason = 'mismo nombre';
    } else if (similarity >= 0.7 && (sharedWords >= 0.3 || similarity >= 0.9)) {
      // Sin direccion ni telefono que corroboren, el parecido de caracteres no
      // alcanza: "Ansal Refrigeracion" y "Rial Materiales Electricos" dan 0,71
      // de Jaro-Winkler y no tienen nada que ver. Pedimos una palabra en comun,
      // o un parecido tan alto que solo se explica por un error de tipeo.
      confidence = Math.round(REVIEW_MATCH_THRESHOLD + (similarity - 0.7) * 80);
      reason = `nombre parecido (${similarity.toFixed(2)})`;
    } else {
      continue;
    }

    if (confidence > best.confidence) best = { storeId: store.id, confidence, reason };
  }

  return best.confidence >= REVIEW_MATCH_THRESHOLD ? best : { storeId: null, confidence: 0, reason: 'sin coincidencias' };
};

export interface ItemMatchResult {
  itemId: string | null;
  confidence: number;
  reason: string;
}

/** Desde aca aceptamos que el producto scrapeado es un item del catalogo. */
export const ITEM_MATCH_THRESHOLD = 85;

/**
 * Matching de producto contra el catalogo de `items`.
 *
 * Es mas exigente que el de empresas a proposito: si erramos el item, el
 * precio scrapeado se le adjudica a otro material y termina en un informe.
 * El SKU manda; si no hay, exigimos nombre casi identico y misma marca.
 */
export const matchItem = (product: NormalizedProduct, items: readonly ItemState[]): ItemMatchResult => {
  const active = items.filter((item) => item.archivedAt === null);

  if (product.sku) {
    const sku = product.sku.toLowerCase();
    const bySku = active.find((item) => item.sku !== null && item.sku.toLowerCase() === sku);
    if (bySku) return { itemId: bySku.id, confidence: 100, reason: 'mismo SKU' };
  }

  const incomingName = materialWords(product.name);
  if (incomingName.length < 3) return { itemId: null, confidence: 0, reason: 'sin nombre comparable' };

  const incomingBrand = product.brand ? companyNameKey(product.brand) : null;

  let best: ItemMatchResult = { itemId: null, confidence: 0, reason: 'sin coincidencias' };

  for (const item of active) {
    const itemName = materialWords(item.name);
    if (itemName.length < 3) continue;

    // La medida manda: distinta medida, distinto material.
    if (compareMeasures(product.name, item.name) !== 'equal') continue;

    const similarity = nameSimilarity(incomingName, itemName);
    if (similarity < 0.85) continue;

    const itemBrand = item.brand ? companyNameKey(item.brand) : null;
    const brandAgrees = incomingBrand !== null && itemBrand !== null && incomingBrand === itemBrand;
    const brandConflicts = incomingBrand !== null && itemBrand !== null && incomingBrand !== itemBrand;

    // Marcas distintas con nombre parecido son productos distintos.
    if (brandConflicts) continue;

    const confidence = Math.round(similarity * 100) + (brandAgrees ? 5 : 0);
    const reason = brandAgrees
      ? `nombre (${similarity.toFixed(2)}) y misma marca`
      : `nombre (${similarity.toFixed(2)})`;

    if (confidence > best.confidence) best = { itemId: item.id, confidence: Math.min(confidence, 99), reason };
  }

  return best;
};

/** Desde aca un material importado se marca como posible duplicado del catalogo. */
export const ITEM_REVIEW_THRESHOLD = 60;

/**
 * Mejor coincidencia de un material por nombre, sin umbral.
 *
 * Existe aparte de `matchItem` porque el import necesita las dos respuestas:
 * la certeza (para reusar el item) y la sospecha (para avisar que el catalogo
 * quizas ya tiene ese material con otro nombre). El catalogo del equipo dice
 * "Caño 1/4 (mt)" y la planilla dice 'Cano de cobre 1/4"': no alcanza para
 * unificarlos solo, pero callarlo es dejar dos materiales iguales en el
 * buscador.
 */
export const bestItemNameMatch = (
  name: string,
  unit: string | null,
  items: readonly ItemState[],
): ItemMatchResult => {
  const incomingWords = materialWords(name);
  if (incomingWords.length < 3) return { itemId: null, confidence: 0, reason: 'sin nombre comparable' };

  let best: ItemMatchResult = { itemId: null, confidence: 0, reason: 'sin coincidencias' };

  for (const item of items) {
    if (item.archivedAt !== null) continue;

    // Primero la medida. Si difiere, no hay nada que discutir: el cable 3x2,5
    // no es el 3x1,5 por mas que los nombres se parezcan un 87%.
    const relation = compareMeasures(name, item.name);
    if (relation === 'different') continue;

    const itemWords = materialWords(item.name);

    // Compartir la medida no alcanza: "Manguera cristal 1/4" y "Caño 1/4" son
    // los dos de 1/4. Hace falta una palabra en comun, o un parecido tan alto
    // que solo se explique por como se escribio el nombre.
    const similarity = nameSimilarity(incomingWords, itemWords);
    if (tokenOverlap(incomingWords, itemWords) < 0.3 && jaroWinkler(incomingWords, itemWords) < 0.8) continue;

    // La unidad corrobora: dos materiales con nombre parecido pero uno por
    // metro y otro por tira no son el mismo.
    const sameUnit = unitsMatch(unit, item.unit);
    const raw = Math.round(similarity * 100 * (sameUnit ? 1 : 0.75));

    // Con medidas parciales ("Aislante 1/4" contra "Aislacion 1/4 espesor 6 mm")
    // el tope deja el resultado debajo del umbral automatico: se reporta, no se
    // aplica solo.
    const confidence = relation === 'subset' ? Math.min(raw, ITEM_MATCH_THRESHOLD - 15) : raw;

    if (confidence > best.confidence) {
      const detail = relation === 'subset' ? 'medida parcial' : sameUnit ? 'misma unidad' : 'otra unidad';
      best = {
        itemId: item.id,
        confidence,
        reason: `"${item.name}" (${similarity.toFixed(2)}, ${detail})`,
      };
    }
  }

  return best;
};
