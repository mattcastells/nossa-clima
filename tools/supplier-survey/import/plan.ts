/**
 * Plan de carga de la planilla.
 *
 * Se diferencia del plan del scraper en una sola cosa, y es a proposito: la
 * planilla la armo y verifico una persona, asi que las tiendas que ademas
 * tienen precios relevados SI entran al catalogo. Las otras dos hojas —las que
 * no publican precios y las de fuera del AMBA— van a `supplier_candidates`,
 * porque son proveedores reales pero nadie decidio todavia si el equipo los usa,
 * y `stores` es la lista que el tecnico ve al elegir el origen de un material.
 *
 * Lo que NO cambia respecto del scraper:
 *   - una tienda que ya existe se actualiza con el mismo merge a tres vias;
 *   - no se pisa `description` ni `notes` de una tienda existente;
 *   - todo lleva su fuente y su fecha;
 *   - reimportar la misma planilla no duplica nada.
 */

import type { DatabaseState, FieldConflict, NormalizedCompany, StoreUpdatePlan } from '../core/types.ts';
import {
  AUTO_MATCH_THRESHOLD,
  ITEM_MATCH_THRESHOLD,
  ITEM_REVIEW_THRESHOLD,
  bestItemNameMatch,
  matchCompany,
} from '../dedupe/match.ts';
import { priceObservationRef } from '../dedupe/fingerprint.ts';
import { planStoreUpdate, isNoopUpdate } from '../merge/threeWay.ts';
import { companyNameKey } from '../normalize/text.ts';
import { canonicalUnit } from '../normalize/unit.ts';
import type { ImportedPrice, ImportedWorkbook } from './ambaSheet.ts';
import { deterministicUuid, itemUuid, storeUuid } from './ids.ts';

export interface StoreInsert {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string;
  canonicalDomain: string;
  description: string | null;
  notes: string | null;
  scrapedSnapshot: Record<string, string | null>;
}

export interface CandidateInsert {
  company: NormalizedCompany;
  notes: string | null;
  tier: string;
  matchStoreId: string | null;
  matchConfidence: number;
  matchReason: string;
  decision: 'new' | 'needs_review' | 'update';
}

export interface ItemInsert {
  id: string;
  name: string;
  category: string;
  unit: string;
  variantLabel: string | null;
  presentationQuantity: number | null;
  presentationUnit: string | null;
}

export interface PriceInsert {
  storeId: string;
  storeName: string;
  itemId: string;
  itemName: string;
  /** Precio POR UNIDAD. Es lo que la app multiplica por la cantidad. */
  price: number;
  currency: string;
  observedAt: string;
  quantityReference: string | null;
  notes: string | null;
  sourceUrl: string;
  externalRef: string;
}

export interface ImportPlan {
  /** Id determinista de la carga: la misma planilla da siempre el mismo. */
  runId: string;
  surveyDate: string;
  storeInserts: StoreInsert[];
  storeUpdates: StoreUpdatePlan[];
  candidates: CandidateInsert[];
  itemInserts: ItemInsert[];
  priceInserts: PriceInsert[];
  /** Precios que no se pudieron cargar, con el motivo. */
  skippedPrices: Array<{ price: ImportedPrice; reason: string }>;
  conflicts: Array<{ storeName: string; conflicts: FieldConflict[] }>;
  /** Materiales de la planilla que se parecen a uno que ya esta en el catalogo. */
  possibleItemDuplicates: Array<{ importedName: string; unit: string; existing: string; confidence: number }>;
  /** Materiales reusados del catalogo en vez de crear uno nuevo. */
  reusedItems: Array<{ importedName: string; existing: string; confidence: number }>;
  warnings: string[];
}

/** Clave de identidad de un material: nombre + variante + unidad. */
export const itemKeyFor = (name: string, variantLabel: string | null, unit: string): string =>
  [companyNameKey(name), companyNameKey(variantLabel ?? ''), unit.trim().toLowerCase()].join('|');

const findExistingItem = (state: DatabaseState, key: string): string | null => {
  for (const item of state.items) {
    if (item.archivedAt !== null) continue;
    if (itemKeyFor(item.name, item.variantLabel, item.unit ?? '') === key) return item.id;
  }
  return null;
};

/**
 * La hoja de precios no siempre escribe el nombre completo de la tienda: dice
 * "Giovagnini" donde la hoja de tiendas dice "Giovagnini Climatizacion". Se
 * resuelve por nombre exacto y, si no, por la unica tienda que contenga todas
 * las palabras. Si hay mas de una candidata no se adivina: el precio se saltea.
 */
const resolveStoreId = (storeName: string, storeIdByName: ReadonlyMap<string, string>): string | null => {
  const direct = storeIdByName.get(storeName);
  if (direct) return direct;

  const wanted = companyNameKey(storeName).split(' ').filter((word) => word.length > 1);
  if (wanted.length === 0) return null;

  const matches = [...storeIdByName.entries()].filter(([name]) => {
    const words = new Set(companyNameKey(name).split(' '));
    return wanted.every((word) => words.has(word));
  });

  return matches.length === 1 ? (matches[0]?.[1] ?? null) : null;
};

/** Cantidad y unidad de la presentacion, cuando se vende por paquete. */
const presentationOf = (price: ImportedPrice): { quantity: number | null; unit: string | null } =>
  price.quantityPerUnit > 1 ? { quantity: price.quantityPerUnit, unit: price.unit } : { quantity: null, unit: null };

const formatArs = (value: number): string =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(value);

/**
 * Nota de la observacion. Guarda el precio publicado cuando difiere del
 * unitario: sin eso, alguien que ve $5.561 no puede reconstruir que en realidad
 * pago $83.421 por un rollo de 15 metros.
 */
const priceNote = (price: ImportedPrice): string | null => {
  const parts: string[] = [];

  if (price.quantityPerUnit > 1) {
    parts.push(
      `Publicado ${formatArs(price.publishedPrice)} por ${price.variantLabel ?? `${price.quantityPerUnit} ${price.unit}`}`,
    );
  }
  if (price.note) parts.push(price.note);

  return parts.length > 0 ? parts.join('. ') : null;
};

export const buildImportPlan = (
  workbook: ImportedWorkbook,
  state: DatabaseState,
  sourceFile = 'planilla-amba',
): ImportPlan => {
  const surveyDate = workbook.surveyDate ?? new Date().toISOString();
  const runId = deterministicUuid('import-run', `${sourceFile}|${surveyDate}`);

  const storeInserts: StoreInsert[] = [];
  const storeUpdates: StoreUpdatePlan[] = [];
  const candidates: CandidateInsert[] = [];
  const conflicts: ImportPlan['conflicts'] = [];
  const warnings = [...workbook.warnings];

  /** Nombre de la planilla -> id de tienda, para enganchar los precios. */
  const storeIdByName = new Map<string, string>();
  /** Id de tienda -> dominio, que es lo que identifica la fuente del precio. */
  const domainByStoreId = new Map<string, string>();

  for (const imported of workbook.companies) {
    // El lector ya descarta las filas sin nombre; esto es para el tipo.
    const companyName = imported.company.name;
    if (!companyName) continue;

    // Lo que ya se descarto en una revision anterior no vuelve a la cola.
    if (state.dismissedDomains.has(imported.company.canonicalDomain)) {
      warnings.push(`"${imported.company.name}" fue descartada antes; la salteo.`);
      continue;
    }

    const match = matchCompany(imported.company, state.stores);
    const existing = match.storeId ? state.stores.find((store) => store.id === match.storeId) : undefined;

    // Ya existe: se actualiza con el mismo merge que usa el scraper.
    if (existing && match.confidence >= AUTO_MATCH_THRESHOLD) {
      const update = planStoreUpdate(existing, imported.company);
      if (!isNoopUpdate(update)) storeUpdates.push(update);
      if (update.conflicts.length > 0) conflicts.push({ storeName: existing.name, conflicts: update.conflicts });

      storeIdByName.set(companyName, existing.id);
      domainByStoreId.set(existing.id, imported.company.canonicalDomain);
      continue;
    }

    // Coincidencia parcial: no la aplicamos sola aunque tenga precios.
    if (existing) {
      candidates.push({
        company: imported.company,
        notes: imported.notes,
        tier: imported.tier,
        matchStoreId: existing.id,
        matchConfidence: match.confidence,
        matchReason: `posible duplicado de "${existing.name}": ${match.reason}`,
        decision: 'needs_review',
      });

      if (imported.tier === 'con-precios') {
        warnings.push(
          `"${imported.company.name}" se parece a "${existing.name}" (${match.confidence}%). ` +
            'Sus precios no se cargan hasta que resuelvas si son la misma tienda.',
        );
      }
      continue;
    }

    // Tienda nueva con precios relevados: entra al catalogo.
    if (imported.tier === 'con-precios') {
      const id = storeUuid(imported.company.canonicalDomain);
      const snapshot: Record<string, string | null> = {
        name: companyName,
        address: imported.company.address,
        phone: imported.company.phone,
        website: imported.company.website,
        canonical_domain: imported.company.canonicalDomain,
      };

      storeInserts.push({
        id,
        name: companyName,
        address: imported.company.address,
        phone: imported.company.phone,
        website: imported.company.website ?? `https://${imported.company.canonicalDomain}`,
        canonicalDomain: imported.company.canonicalDomain,
        description: imported.company.description,
        notes: imported.notes,
        scrapedSnapshot: snapshot,
      });

      storeIdByName.set(companyName, id);
      domainByStoreId.set(id, imported.company.canonicalDomain);
      continue;
    }

    // Las otras dos hojas quedan a revision.
    candidates.push({
      company: imported.company,
      notes: imported.notes,
      tier: imported.tier,
      matchStoreId: null,
      matchConfidence: 0,
      matchReason:
        imported.tier === 'sin-precios-web'
          ? 'proveedor del AMBA que no publica precios en su web'
          : 'proveedor fuera del AMBA con envio nacional',
      decision: 'new',
    });
  }

  // ---- Materiales y precios ------------------------------------------------

  const itemInserts: ItemInsert[] = [];
  const itemIdByKey = new Map<string, string>();
  const priceInserts: PriceInsert[] = [];
  const skippedPrices: ImportPlan['skippedPrices'] = [];
  const possibleItemDuplicates: ImportPlan['possibleItemDuplicates'] = [];
  const reusedItems: ImportPlan['reusedItems'] = [];
  const seenRefs = new Set<string>();
  const seenPairs = new Set<string>();

  for (const price of workbook.prices) {
    const storeId = resolveStoreId(price.storeName, storeIdByName);
    if (!storeId) {
      skippedPrices.push({
        price,
        reason: `la tienda "${price.storeName}" no quedo resuelta en el catalogo`,
      });
      continue;
    }

    const unit = canonicalUnit(price.unit) ?? price.unit;
    const key = itemKeyFor(price.itemName, price.variantLabel, unit);

    let itemId = itemIdByKey.get(key) ?? findExistingItem(state, key);

    if (!itemId) {
      // El catalogo del equipo puede tener el mismo material con otro nombre.
      // Con certeza lo reusamos; con sospecha creamos uno nuevo y lo avisamos,
      // porque adjudicar mal un precio termina en un informe de cliente.
      //
      // Solo se reusa cuando la planilla vende la unidad suelta: el item que ya
      // esta cargado ("Caño 1/4 (mt)") es el metro suelto. Si mandaramos ahi
      // tambien el precio del rollo, la misma tienda tendria dos precios para
      // el mismo material el mismo dia y la app mostraria cualquiera de los dos.
      const similar =
        price.quantityPerUnit === 1
          ? bestItemNameMatch(price.itemName, unit, state.items)
          : { itemId: null, confidence: 0, reason: 'presentacion por paquete' };

      if (similar.itemId !== null && similar.confidence >= ITEM_MATCH_THRESHOLD) {
        itemId = similar.itemId;
        reusedItems.push({ importedName: price.itemName, existing: similar.reason, confidence: similar.confidence });
      } else {
        if (similar.itemId !== null && similar.confidence >= ITEM_REVIEW_THRESHOLD) {
          possibleItemDuplicates.push({
            importedName: price.itemName,
            unit,
            existing: similar.reason,
            confidence: similar.confidence,
          });
        }

        itemId = itemUuid(key);
        const presentation = presentationOf(price);

        itemInserts.push({
          id: itemId,
          name: price.itemName,
          category: price.category,
          unit,
          variantLabel: price.variantLabel,
          presentationQuantity: presentation.quantity,
          presentationUnit: presentation.unit === null ? null : (canonicalUnit(presentation.unit) ?? presentation.unit),
        });
      }
    }
    itemIdByKey.set(key, itemId);

    // El dominio es lo que hace estable la huella entre corridas: el nombre de
    // la tienda en la planilla puede cambiar, el dominio no.
    const domain = domainByStoreId.get(storeId) ?? price.storeName;
    const externalRef = priceObservationRef(domain, key, price.unitPrice, 'ARS');

    // La misma tienda no puede publicar dos precios distintos para el mismo
    // item y la misma variante: si pasa, la planilla tiene una fila repetida.
    if (seenRefs.has(externalRef)) {
      skippedPrices.push({ price, reason: 'observacion repetida en la planilla' });
      continue;
    }
    seenRefs.add(externalRef);

    if (state.priceRefs.has(externalRef)) {
      skippedPrices.push({ price, reason: 'ya estaba registrada en la base' });
      continue;
    }

    // Una tienda no puede tener dos precios distintos del mismo material con la
    // misma fecha: la vista de "ultimo precio" elegiria uno al azar.
    const pairKey = `${storeId}|${itemId}`;
    if (seenPairs.has(pairKey)) {
      skippedPrices.push({ price, reason: `"${price.storeName}" ya tiene un precio de este material en la planilla` });
      continue;
    }
    seenPairs.add(pairKey);

    priceInserts.push({
      storeId,
      storeName: price.storeName,
      itemId,
      itemName: price.itemName,
      price: price.unitPrice,
      currency: 'ARS',
      observedAt: surveyDate,
      quantityReference: price.variantLabel,
      notes: priceNote(price),
      sourceUrl: `https://${domain}`,
      externalRef,
    });
  }

  return {
    runId,
    surveyDate,
    storeInserts,
    storeUpdates,
    candidates,
    itemInserts,
    priceInserts,
    skippedPrices,
    conflicts,
    possibleItemDuplicates,
    reusedItems,
    warnings,
  };
};
