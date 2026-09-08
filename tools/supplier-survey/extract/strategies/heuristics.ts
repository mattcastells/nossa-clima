/**
 * Ultimo recurso: leer el texto de la pagina.
 *
 * Confianza baja a proposito. Solo completa lo que JSON-LD y las meta tags no
 * trajeron; nunca le gana a una fuente estructurada. Es lo que salva a los
 * sitios viejos hechos a mano, que en este rubro son muchos.
 */

import { field, type RawCompany, type Provenance } from '../../core/types.ts';
import { formatPhone, findPhones } from '../../normalize/phone.ts';
import { cleanText, foldAccents } from '../../normalize/text.ts';
import { findEmails, extractTagContents } from '../html.ts';
import type { CompanyStrategy, PageContext } from '../types.ts';

const provenanceFor = (page: PageContext, confidence: number): Provenance => ({
  sourceUrl: page.url,
  strategy: 'heuristics',
  confidence,
  observedAt: page.scrapedAt,
});

/**
 * Calles y lugares argentinos. Una direccion util tiene tipo de via + numero,
 * o una localidad conocida. Sin numero no la tomamos: "Buenos Aires" solo no
 * sirve para ir a comprar.
 */
const ADDRESS_PATTERN =
  /\b(av\.?|avda\.?|avenida|calle|ruta|autopista|colectora|pasaje|diagonal|bv\.?|boulevard)\s+[^\n,;]{3,60}?\s+\d{1,5}\b/i;

const ADDRESS_WITH_NUMBER = /\b[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ.'-]{2,}(?:\s+[\wÁÉÍÓÚÑáéíóúñ.'-]+){0,4}\s+\d{2,5}\b/;

const ADDRESS_CONTEXT = [
  'direccion',
  'domicilio',
  'sucursal',
  'local',
  'showroom',
  'deposito',
  'nos encontras',
  'donde estamos',
  'como llegar',
  'visitanos',
];

/**
 * Busca la direccion en las lineas que hablan de direccion. Recorrer el texto
 * entero con una regex de calles da demasiados falsos positivos (cualquier
 * "Split 3000 frigorias" matchea "palabra + numero").
 */
const findAddress = (text: string): string | null => {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;

    const explicit = line.match(ADDRESS_PATTERN);
    if (explicit) return cleanText(explicit[0]);

    // Linea con contexto de direccion: la respuesta puede estar en la que sigue.
    const folded = foldAccents(line);
    if (!ADDRESS_CONTEXT.some((hint) => folded.includes(hint))) continue;

    const sameLine = line.replace(/^[^:]{0,40}:\s*/, '');
    if (sameLine !== line && ADDRESS_WITH_NUMBER.test(sameLine)) return cleanText(sameLine);

    const next = lines[index + 1];
    if (next && next.length <= 120 && ADDRESS_WITH_NUMBER.test(next)) return cleanText(next);
  }

  return null;
};

export const heuristicsCompanyStrategy: CompanyStrategy = {
  name: 'heuristics',
  confidence: 0.4,

  canHandle: (page) => page.text.length > 0,

  extract: (page) => {
    const company: RawCompany = {};
    const provenance = provenanceFor(page, 0.4);

    const phones = findPhones(page.html);
    const firstPhone = phones[0];
    if (firstPhone) {
      const formatted = formatPhone(firstPhone);
      if (formatted) company.phone = field(formatted, provenance);
    }

    const emails = findEmails(page.html);
    const firstEmail = emails[0];
    if (firstEmail) company.email = field(firstEmail, provenance);

    const address = findAddress(page.text);
    if (address) company.address = field(address, provenance);

    // El h1 de una home suele ser la marca o el slogan.
    const heading = extractTagContents(page.html, 'h1')[0];
    const headingText = cleanText(heading);
    if (headingText && headingText.length <= 80) company.name = field(headingText, provenance);

    return company;
  },
};
