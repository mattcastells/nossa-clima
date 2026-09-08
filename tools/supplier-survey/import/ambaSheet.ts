/**
 * Mapeo de la planilla "Tiendas insumos refrigeracion AMBA" al modelo.
 *
 * La planilla tiene cuatro hojas de datos y una de metodologia. Las columnas se
 * ubican por su encabezado, no por posicion fija: si el mes que viene alguien
 * agrega una columna al medio, el import sigue andando.
 *
 * Decision de mapeo importante — el precio que se guarda es el UNITARIO, no el
 * publicado. La app multiplica cantidad x precio para armar el presupuesto: si
 * guardaramos los $83.421 del rollo de 15 m, un trabajo de 8 metros saldria
 * diez veces mas caro. El precio publicado y la presentacion quedan en
 * `quantity_reference` y en las notas de la observacion, que es donde el
 * modelo ya los esperaba.
 */

import type { NormalizedCompany } from '../core/types.ts';
import { companyFingerprint } from '../dedupe/fingerprint.ts';
import { canonicalDomain, canonicalUrl } from '../normalize/domain.ts';
import { findPhones, formatPhone } from '../normalize/phone.ts';
import { parseSpreadsheetNumber } from '../normalize/price.ts';
import { cleanText, foldAccents } from '../normalize/text.ts';
import { cell, findSheet, type Sheet } from './xlsx.ts';

/** De que hoja salio la tienda. Define si entra al catalogo o a revision. */
export type StoreTier = 'con-precios' | 'sin-precios-web' | 'fuera-amba';

export interface ImportedCompany {
  company: NormalizedCompany;
  /** Texto para `stores.notes` cuando la tienda se crea. */
  notes: string | null;
  tier: StoreTier;
  zone: string | null;
}

export interface ImportedPrice {
  storeName: string;
  category: string;
  itemName: string;
  /** "Rollo 15 m", "Por metro, 0,8 mm", "Tira Cooltech". */
  variantLabel: string | null;
  unit: string;
  publishedPrice: number;
  quantityPerUnit: number;
  unitPrice: number;
  note: string | null;
}

export interface ImportedWorkbook {
  companies: ImportedCompany[];
  prices: ImportedPrice[];
  /** Fecha del relevamiento declarada en la hoja de metodologia. */
  surveyDate: string | null;
  warnings: string[];
}

/**
 * Tope de cordura para un precio de insumo, en pesos. No existe un material de
 * instalacion que cueste mas que esto; si aparece, es un error de lectura.
 */
const MAX_REASONABLE_PRICE = 100_000_000;

const SHEET_NAMES = {
  withPrices: 'Tiendas AMBA',
  withoutPrices: 'AMBA sin precios web',
  outside: 'Fuera del AMBA',
  prices: 'Comparativa precios',
  methodology: 'Metodologia',
} as const;

/**
 * Ubica el encabezado buscando la fila que contiene todas las columnas dadas, y
 * devuelve el indice de cada una.
 */
const locateColumns = (
  sheet: Sheet,
  required: readonly string[],
): { headerRow: number; columns: Map<string, number> } | null => {
  for (const row of sheet.rows) {
    const columns = new Map<string, number>();

    for (const [index, value] of row.cells.entries()) {
      const key = foldAccents(value.trim());
      if (key.length > 0 && !columns.has(key)) columns.set(key, index);
    }

    const resolved = new Map<string, number>();
    let complete = true;

    for (const name of required) {
      const key = foldAccents(name);
      const found = [...columns.entries()].find(([header]) => header.startsWith(key));
      if (!found) {
        complete = false;
        break;
      }
      resolved.set(name, found[1]);
    }

    if (complete) return { headerRow: row.rowNumber, columns: resolved };
  }

  return null;
};

/**
 * Fin real de la tabla: un bloque RESUMEN o una nota al pie.
 *
 * El `\b` no es decorativo: sin el, "Totaline Argentina" empieza con "total" y
 * la tienda desaparece del import sin decir nada.
 */
const isTableTerminator = (first: string): boolean =>
  /^(resumen\b|nota\s*:|total(es)?\b\s*$)/i.test(foldAccents(first));

/** Una fila en blanco al medio no corta la tabla: se saltea. */
const isBlankRow = (first: string): boolean => first.trim().length === 0;

const buildCompany = (
  name: string,
  website: string,
  address: string,
  contact: string,
  description: string | null,
  surveyDate: string,
): NormalizedCompany | null => {
  const cleanName = cleanText(name);
  if (!cleanName) return null;

  const url = website ? canonicalUrl(website) : null;
  const domain = url ? canonicalDomain(url) : null;
  if (!domain || !url) return null;

  const phones = findPhones(contact);
  const phone = phones.length > 0 ? phones.map((value) => formatPhone(value)).filter(Boolean).join(' / ') : null;

  return {
    name: cleanName,
    description,
    address: cleanText(address),
    phone,
    email: null,
    website: url,
    canonicalDomain: domain,
    categories: [],
    fingerprint: companyFingerprint(domain, cleanName),
    // Viene de un relevamiento curado por una persona: no hace falta que el
    // scoring automatico decida si es del rubro.
    relevanceScore: 100,
    sourceUrl: url,
    scrapedAt: surveyDate,
    provenance: {
      name: { sourceUrl: url, strategy: 'planilla-amba', confidence: 1, observedAt: surveyDate },
    },
    raw: {},
  };
};

const joinNotes = (parts: ReadonlyArray<string | null>): string | null => {
  const filtered = parts.map((part) => cleanText(part)).filter((part): part is string => part !== null);
  return filtered.length > 0 ? filtered.join('\n') : null;
};

const readStoreSheet = (
  sheet: Sheet | null,
  tier: StoreTier,
  layout: {
    name: string;
    website: string;
    zone: string;
    address: string;
    notes: readonly string[];
    description?: string;
  },
  surveyDate: string,
  warnings: string[],
): ImportedCompany[] => {
  if (!sheet) {
    warnings.push(`Falta la hoja "${tier}" en la planilla.`);
    return [];
  }

  const located = locateColumns(sheet, [layout.name, layout.website, layout.zone, layout.address]);
  if (!located) {
    warnings.push(`No pude ubicar el encabezado de la hoja "${sheet.name}".`);
    return [];
  }

  const optional = locateColumns(sheet, [...layout.notes, ...(layout.description ? [layout.description] : [])]);
  const companies: ImportedCompany[] = [];

  for (const row of sheet.rows) {
    if (row.rowNumber <= located.headerRow) continue;

    const name = cell(row, located.columns.get(layout.name) ?? 0);
    if (isBlankRow(name)) continue;
    if (isTableTerminator(name)) break;

    const website = cell(row, located.columns.get(layout.website) ?? 0);
    const address = cell(row, located.columns.get(layout.address) ?? 0);
    const zone = cleanText(cell(row, located.columns.get(layout.zone) ?? 0));

    const descriptionColumn = layout.description ? optional?.columns.get(layout.description) : undefined;
    const description = descriptionColumn === undefined ? null : cleanText(cell(row, descriptionColumn));

    const noteParts = layout.notes.map((header) => {
      const index = optional?.columns.get(header);
      const value = index === undefined ? '' : cell(row, index);
      return value ? `${header}: ${value}` : null;
    });

    const company = buildCompany(name, website, address, rawContact(row, located, layout), description, surveyDate);

    if (!company) {
      warnings.push(`Fila ${row.rowNumber} de "${sheet.name}": sin nombre o sin sitio web utilizable ("${name}").`);
      continue;
    }

    companies.push({
      company,
      notes: joinNotes([zone ? `Zona: ${zone}` : null, ...noteParts]),
      tier,
      zone,
    });
  }

  return companies;
};

/** El telefono sale de la columna de contacto, que no todas las hojas tienen. */
const rawContact = (
  row: { cells: string[] },
  located: { columns: Map<string, number> },
  layout: { name: string },
): string => {
  const contactIndex = located.columns.get('Contacto');
  if (contactIndex !== undefined) return cell(row, contactIndex);

  // Sin columna propia, buscamos telefonos en toda la fila menos el nombre.
  const nameIndex = located.columns.get(layout.name);
  return row.cells.filter((_value, index) => index !== nameIndex).join(' ');
};

const readPricesSheet = (sheet: Sheet | null, warnings: string[]): ImportedPrice[] => {
  if (!sheet) {
    warnings.push('Falta la hoja "Comparativa precios".');
    return [];
  }

  const located = locateColumns(sheet, ['Rubro', 'Item', 'Unidad', 'Tienda', 'Precio publicado']);
  if (!located) {
    warnings.push('No pude ubicar el encabezado de "Comparativa precios".');
    return [];
  }

  const extra = locateColumns(sheet, ['Medida / presentacion', 'Cant. por unidad', 'Precio unitario', 'Fuente / nota']);
  const prices: ImportedPrice[] = [];

  for (const row of sheet.rows) {
    if (row.rowNumber <= located.headerRow) continue;

    const category = cell(row, located.columns.get('Rubro') ?? 0);
    if (isBlankRow(category)) continue;
    // El RESUMEN de abajo tiene otras columnas: seguir leyendo lo convierte en
    // 18 precios inventados.
    if (isTableTerminator(category)) break;

    const itemName = cleanText(cell(row, located.columns.get('Item') ?? 1));
    const storeName = cleanText(cell(row, located.columns.get('Tienda') ?? 4));
    const unit = cleanText(cell(row, located.columns.get('Unidad') ?? 3));

    if (!itemName || !storeName || !unit) {
      warnings.push(`Fila ${row.rowNumber} de precios incompleta (item/tienda/unidad).`);
      continue;
    }

    // Celdas de planilla: numeros de maquina, sin separador de miles.
    const publishedPrice = parseSpreadsheetNumber(cell(row, located.columns.get('Precio publicado') ?? 6));
    if (publishedPrice === null || publishedPrice <= 0) {
      warnings.push(`Fila ${row.rowNumber} de precios: "${itemName}" en ${storeName} sin precio legible.`);
      continue;
    }

    const quantityIndex = extra?.columns.get('Cant. por unidad');
    const quantityRaw = quantityIndex === undefined ? '' : cell(row, quantityIndex);
    const parsedQuantity = parseSpreadsheetNumber(quantityRaw);
    const quantityPerUnit = parsedQuantity !== null && parsedQuantity > 0 ? parsedQuantity : 1;

    // La columna viene de una formula, asi que trae toda la precision del
    // float: 9074.33266666667. Se redondea a centavos mas abajo.
    const unitPriceIndex = extra?.columns.get('Precio unitario');
    const unitPriceRaw = unitPriceIndex === undefined ? '' : cell(row, unitPriceIndex);
    const parsedUnitPrice = parseSpreadsheetNumber(unitPriceRaw);
    const unitPrice = parsedUnitPrice !== null && parsedUnitPrice > 0 ? parsedUnitPrice : publishedPrice / quantityPerUnit;

    // Red de seguridad: `store_item_prices.price` es numeric(12,2), y un precio
    // absurdo solo puede venir de un error de lectura. Mejor perder la fila que
    // meter un numero inventado en un presupuesto.
    if (unitPrice > MAX_REASONABLE_PRICE || publishedPrice > MAX_REASONABLE_PRICE) {
      warnings.push(
        `Fila ${row.rowNumber}: "${itemName}" en ${storeName} da un precio fuera de rango (${unitPrice}). La salteo.`,
      );
      continue;
    }

    const variantIndex = extra?.columns.get('Medida / presentacion');
    const noteIndex = extra?.columns.get('Fuente / nota');

    prices.push({
      storeName,
      category: cleanText(category) ?? 'Sin rubro',
      itemName,
      variantLabel: variantIndex === undefined ? null : cleanText(cell(row, variantIndex)),
      unit,
      publishedPrice,
      quantityPerUnit,
      // Redondeo a centavos: la columna calculada trae 12 decimales.
      unitPrice: Math.round(unitPrice * 100) / 100,
      note: noteIndex === undefined ? null : cleanText(cell(row, noteIndex)),
    });
  }

  return prices;
};

/** "08/09/2026. Todos los precios..." -> "2026-09-08T00:00:00.000Z" */
const readSurveyDate = (sheet: Sheet | null): string | null => {
  if (!sheet) return null;

  for (const row of sheet.rows) {
    for (const value of row.cells) {
      const match = value.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
      if (!match) continue;

      const [, day, month, year] = match;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  return null;
};

export const readAmbaWorkbook = (sheets: readonly Sheet[]): ImportedWorkbook => {
  const warnings: string[] = [];
  const surveyDate = readSurveyDate(findSheet(sheets, SHEET_NAMES.methodology));

  if (!surveyDate) warnings.push('No encontre la fecha del relevamiento; uso la fecha de hoy.');
  const observedAt = surveyDate ?? new Date().toISOString();

  const companies = [
    ...readStoreSheet(
      findSheet(sheets, SHEET_NAMES.withPrices),
      'con-precios',
      {
        name: 'Tienda',
        website: 'Sitio web',
        zone: 'Zona',
        address: 'Localidad / Direccion',
        description: 'Rubro que cubre',
        notes: ['Precios publicados en la web', 'Envios', 'Observaciones'],
      },
      observedAt,
      warnings,
    ),
    ...readStoreSheet(
      findSheet(sheets, SHEET_NAMES.withoutPrices),
      'sin-precios-web',
      {
        name: 'Tienda',
        website: 'Sitio web',
        zone: 'Zona',
        address: 'Localidad / Direccion',
        notes: ['Por que quedo afuera', 'Igual sirve para'],
      },
      observedAt,
      warnings,
    ),
    ...readStoreSheet(
      findSheet(sheets, SHEET_NAMES.outside),
      'fuera-amba',
      {
        name: 'Tienda',
        website: 'Sitio web',
        zone: 'Provincia / Localidad',
        address: 'Provincia / Localidad',
        notes: ['Precios publicados', 'Envia al AMBA', 'Por que puede interesarte'],
      },
      observedAt,
      warnings,
    ),
  ];

  return {
    companies,
    prices: readPricesSheet(findSheet(sheets, SHEET_NAMES.prices), warnings),
    surveyDate,
    warnings,
  };
};
