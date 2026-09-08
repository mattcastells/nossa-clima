/**
 * Merge a tres vias, igual que un `git merge`.
 *
 *   base     = `stores.scraped_snapshot`, lo ultimo que escribio el scraper
 *   current  = lo que hay hoy en la fila
 *   incoming = lo que dice el sitio ahora
 *
 * | base | current | incoming | resultado                                  |
 * |------|---------|----------|--------------------------------------------|
 * | -    | -       | X        | escribe X            (completa un hueco)   |
 * | X    | X       | Y        | escribe Y            (nadie lo toco)       |
 * | X    | Z       | Y        | CONFLICTO            (lo edito una persona)|
 * | X    | Z       | X        | no toca              (respeta lo humano)   |
 * | X    | X       | -        | no toca              (el sitio dejo de publicarlo) |
 *
 * La fila que importa es la tercera: sin `base` no habria forma de distinguir
 * "el valor cambio porque lo edito el tecnico" de "el valor cambio porque el
 * sitio publica otra cosa", y el scraper terminaria pisando trabajo humano.
 */

import type { FieldConflict, NormalizedCompany, StoreState, StoreUpdatePlan } from '../core/types.ts';
import { companyNameKey } from '../normalize/text.ts';
import { policyFor, STORE_MANAGED_FIELDS } from './policy.ts';

export type MergeOutcome =
  | { kind: 'write'; value: string | null; reason: 'fill' | 'refresh' }
  | { kind: 'skip'; reason: 'no-change' | 'no-incoming' | 'human-owned' | 'protected' }
  | { kind: 'conflict'; reason: 'human-edit' };

const same = (a: string | null, b: string | null): boolean => (a ?? '') === (b ?? '');

/** Decide un solo campo. Sin efectos: devuelve que habria que hacer. */
export const mergeField = (
  fieldName: string,
  base: string | null,
  current: string | null,
  incoming: string | null,
): MergeOutcome => {
  const policy = policyFor(fieldName);

  if (policy === 'protected') {
    if (incoming === null || same(current, incoming)) return { kind: 'skip', reason: 'protected' };
    return { kind: 'conflict', reason: 'human-edit' };
  }

  if (incoming === null) return { kind: 'skip', reason: 'no-incoming' };
  if (same(current, incoming)) return { kind: 'skip', reason: 'no-change' };

  // El sitio dice lo mismo que la ultima vez. No hay informacion nueva, asi que
  // no hay nada que proponer ni nada que reportar, aunque el valor de la base
  // difiera: esa diferencia es una edicion humana ya asumida.
  if (same(base, incoming)) return { kind: 'skip', reason: 'no-change' };

  if (current === null || current.trim().length === 0) {
    // Hueco que el scraper nunca lleno: completar no destruye nada.
    if (base === null || base.trim().length === 0) return { kind: 'write', value: incoming, reason: 'fill' };
    // El scraper habia escrito algo y hoy esta vacio: alguien lo borro a mano.
    return { kind: 'conflict', reason: 'human-edit' };
  }

  if (policy === 'fill-only') {
    // Ya tiene valor. Si lo puso el scraper y el sitio cambio, vale avisar;
    // si lo puso una persona, ni eso.
    return same(base, current) ? { kind: 'conflict', reason: 'human-edit' } : { kind: 'skip', reason: 'human-owned' };
  }

  // 'managed': se refresca solo si el valor actual es el que dejo el scraper.
  if (same(base, current)) return { kind: 'write', value: incoming, reason: 'refresh' };

  return { kind: 'conflict', reason: 'human-edit' };
};

const readSnapshot = (store: StoreState, fieldName: string): string | null => {
  const snapshot = store.scrapedSnapshot;
  if (!snapshot) return null;
  const value = snapshot[fieldName];
  return typeof value === 'string' ? value : null;
};

const currentValue = (store: StoreState, fieldName: string): string | null => {
  switch (fieldName) {
    case 'website':
      return store.website;
    case 'email':
      return store.email;
    case 'address':
      return store.address;
    case 'phone':
      return store.phone;
    case 'canonical_domain':
      return store.canonicalDomain;
    case 'name':
      return store.name;
    case 'description':
      return store.description;
    case 'notes':
      return store.notes;
    default:
      return null;
  }
};

const incomingValue = (company: NormalizedCompany, fieldName: string): string | null => {
  switch (fieldName) {
    case 'website':
      return company.website;
    case 'email':
      return company.email;
    case 'address':
      return company.address;
    case 'phone':
      return company.phone;
    case 'canonical_domain':
      return company.canonicalDomain;
    case 'name':
      return company.name;
    case 'description':
      return company.description;
    default:
      return null;
  }
};

/**
 * Arma el plan de actualizacion de una tienda ya conocida.
 * No escribe nada: devuelve que se escribiria y que quedo en conflicto.
 */
export const planStoreUpdate = (store: StoreState, company: NormalizedCompany): StoreUpdatePlan => {
  const changes: Record<string, string | null> = {};
  const conflicts: FieldConflict[] = [];
  const nextSnapshot: Record<string, string | null> = { ...(store.scrapedSnapshot ?? {}) };

  for (const fieldName of STORE_MANAGED_FIELDS) {
    const base = readSnapshot(store, fieldName);
    const current = currentValue(store, fieldName);
    const incoming = incomingValue(company, fieldName);

    const outcome = mergeField(fieldName, base, current, incoming);

    if (outcome.kind === 'write') {
      changes[fieldName] = outcome.value;
      nextSnapshot[fieldName] = outcome.value;
      continue;
    }

    if (outcome.kind === 'conflict') {
      conflicts.push({ fieldName, base, current, incoming, reason: 'human-edit' });
      continue;
    }

    // Aunque no escribamos, el snapshot registra lo que el sitio publica hoy:
    // es lo que permite detectar en la proxima corrida que el sitio cambio.
    if (incoming !== null) nextSnapshot[fieldName] = incoming;
  }

  // El nombre no se escribe nunca, pero un cambio real se reporta.
  const incomingName = company.name;
  if (incomingName !== null && companyNameKey(incomingName) !== companyNameKey(store.name)) {
    conflicts.push({
      fieldName: 'name',
      base: readSnapshot(store, 'name'),
      current: store.name,
      incoming: incomingName,
      reason: 'identity-change',
    });
  }
  if (incomingName !== null) nextSnapshot.name = incomingName;

  return {
    storeId: store.id,
    storeName: store.name,
    canonicalDomain: company.canonicalDomain,
    sourceUrl: company.sourceUrl,
    changes,
    conflicts,
    nextSnapshot,
  };
};

/** true si el plan no propone ni cambios ni conflictos: no hay nada que hacer. */
export const isNoopUpdate = (plan: StoreUpdatePlan): boolean =>
  Object.keys(plan.changes).length === 0 && plan.conflicts.length === 0;
