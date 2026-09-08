import { describe, expect, it } from 'vitest';

import type { NormalizedCompany, StoreState } from '../core/types.ts';
import { isNoopUpdate, mergeField, planStoreUpdate } from '../merge/threeWay.ts';

const store = (overrides: Partial<StoreState> = {}): StoreState => ({
  id: 'store-1',
  name: 'Pizarro',
  description: '8:30-12:30 - 14-16',
  address: 'Av. de los Constituyentes 3729',
  phone: '1145712411',
  email: null,
  website: null,
  notes: 'Celular Gustavo: 1145386043',
  canonicalDomain: null,
  source: 'manual',
  sourceType: 'manual',
  archivedAt: null,
  scrapedSnapshot: null,
  ...overrides,
});

const company = (overrides: Partial<NormalizedCompany> = {}): NormalizedCompany => ({
  name: 'Pizarro',
  description: 'Insumos de refrigeracion',
  address: 'Av. de los Constituyentes 3729',
  phone: '1145712411',
  email: 'ventas@pizarro.com.ar',
  website: 'https://pizarro.com.ar',
  canonicalDomain: 'pizarro.com.ar',
  categories: ['hvac'],
  fingerprint: 'fp-1',
  relevanceScore: 75,
  sourceUrl: 'https://pizarro.com.ar',
  scrapedAt: '2026-09-08T12:00:00.000Z',
  provenance: {},
  raw: {},
  ...overrides,
});

describe('mergeField', () => {
  it('completa un campo vacio', () => {
    expect(mergeField('email', null, null, 'a@b.com')).toEqual({ kind: 'write', value: 'a@b.com', reason: 'fill' });
  });

  it('refresca un valor que habia escrito el propio scraper', () => {
    expect(mergeField('email', 'viejo@b.com', 'viejo@b.com', 'nuevo@b.com')).toEqual({
      kind: 'write',
      value: 'nuevo@b.com',
      reason: 'refresh',
    });
  });

  it('NO pisa un valor que edito una persona', () => {
    // base != current => alguien lo toco a mano. Es el caso que justifica todo.
    const outcome = mergeField('email', 'viejo@b.com', 'editado@b.com', 'nuevo@b.com');
    expect(outcome).toEqual({ kind: 'conflict', reason: 'human-edit' });
  });

  it('respeta lo humano cuando el sitio no cambio', () => {
    // base = incoming: el sitio sigue diciendo lo mismo. La diferencia contra
    // la base es una edicion humana ya asumida; no se toca ni se reporta.
    expect(mergeField('email', 'viejo@b.com', 'editado@b.com', 'viejo@b.com')).toEqual({
      kind: 'skip',
      reason: 'no-change',
    });
  });

  it('reporta como conflicto un campo que el scraper lleno y alguien vacio', () => {
    expect(mergeField('email', 'viejo@b.com', null, 'nuevo@b.com')).toEqual({
      kind: 'conflict',
      reason: 'human-edit',
    });
  });

  it('no hace nada si el sitio dejo de publicar el dato', () => {
    expect(mergeField('email', 'viejo@b.com', 'viejo@b.com', null)).toEqual({ kind: 'skip', reason: 'no-incoming' });
  });

  it('no hace nada si el valor es el mismo', () => {
    expect(mergeField('email', 'a@b.com', 'a@b.com', 'a@b.com')).toEqual({ kind: 'skip', reason: 'no-change' });
  });

  describe('campos fill-only', () => {
    it('completa si esta vacio', () => {
      expect(mergeField('phone', null, null, '11 4571-2411')).toEqual({
        kind: 'write',
        value: '11 4571-2411',
        reason: 'fill',
      });
    });

    it('no refresca aunque lo hubiera puesto el scraper: solo avisa', () => {
      expect(mergeField('phone', '11 1111-1111', '11 1111-1111', '11 2222-2222')).toEqual({
        kind: 'conflict',
        reason: 'human-edit',
      });
    });

    it('ni siquiera avisa si el valor actual es de una persona', () => {
      expect(mergeField('phone', '11 1111-1111', '11 9999-9999', '11 2222-2222')).toEqual({
        kind: 'skip',
        reason: 'human-owned',
      });
    });
  });

  describe('campos protegidos', () => {
    it('nunca escribe notes ni description', () => {
      expect(mergeField('notes', null, null, 'algo').kind).not.toBe('write');
      expect(mergeField('description', null, null, 'algo').kind).not.toBe('write');
    });

    it('reporta el cambio como conflicto', () => {
      expect(mergeField('description', null, '8:30-17', 'Insumos de refrigeracion')).toEqual({
        kind: 'conflict',
        reason: 'human-edit',
      });
    });

    it('un campo desconocido se trata como protegido', () => {
      expect(mergeField('campo_inventado', null, null, 'x').kind).not.toBe('write');
    });
  });
});

describe('planStoreUpdate', () => {
  it('completa los huecos y deja intacto lo cargado a mano', () => {
    const plan = planStoreUpdate(store(), company());

    expect(plan.changes.email).toBe('ventas@pizarro.com.ar');
    expect(plan.changes.website).toBe('https://pizarro.com.ar');
    expect(plan.changes.canonical_domain).toBe('pizarro.com.ar');

    // La direccion y el telefono ya estaban: no se tocan.
    expect(plan.changes.address).toBeUndefined();
    expect(plan.changes.phone).toBeUndefined();

    // description y notes ni aparecen: son del tecnico.
    expect(plan.changes.description).toBeUndefined();
    expect(plan.changes.notes).toBeUndefined();
  });

  it('reporta un cambio de nombre como conflicto de identidad, sin escribirlo', () => {
    const plan = planStoreUpdate(store(), company({ name: 'Pizarro Refrigeracion S.A.' }));

    expect(plan.changes.name).toBeUndefined();
    // "Pizarro Refrigeracion" no colapsa a "pizarro": es un cambio real.
    const conflict = plan.conflicts.find((entry) => entry.fieldName === 'name');
    expect(conflict?.reason).toBe('identity-change');
    expect(conflict?.incoming).toBe('Pizarro Refrigeracion S.A.');
  });

  it('no reporta conflicto cuando el nombre solo cambia de forma societaria', () => {
    const plan = planStoreUpdate(store(), company({ name: 'PIZARRO S.R.L.' }));
    expect(plan.conflicts.find((entry) => entry.fieldName === 'name')).toBeUndefined();
  });

  it('guarda en el snapshot lo que publica el sitio aunque no lo escriba', () => {
    // Asi la proxima corrida puede distinguir "el sitio cambio" de "el sitio
    // sigue diciendo lo mismo".
    const plan = planStoreUpdate(store(), company({ address: 'Otra Calle 100' }));

    expect(plan.changes.address).toBeUndefined();
    expect(plan.nextSnapshot.address).toBe('Otra Calle 100');
  });

  it('es idempotente: la segunda corrida con los mismos datos no propone nada', () => {
    const first = planStoreUpdate(store(), company());

    const afterApply = store({
      email: first.changes.email ?? null,
      website: first.changes.website ?? null,
      canonicalDomain: first.changes.canonical_domain ?? null,
      scrapedSnapshot: first.nextSnapshot,
    });

    const second = planStoreUpdate(afterApply, company());

    expect(second.changes).toEqual({});
    expect(second.conflicts).toEqual([]);
    expect(isNoopUpdate(second)).toBe(true);
  });

  it('detecta que una persona edito un campo que el scraper habia escrito', () => {
    const first = planStoreUpdate(store(), company());

    const editedByHuman = store({
      email: 'otro@pizarro.com.ar',
      website: first.changes.website ?? null,
      canonicalDomain: first.changes.canonical_domain ?? null,
      scrapedSnapshot: first.nextSnapshot,
    });

    const second = planStoreUpdate(editedByHuman, company({ email: 'nuevo@pizarro.com.ar' }));

    expect(second.changes.email).toBeUndefined();
    expect(second.conflicts.some((conflict) => conflict.fieldName === 'email')).toBe(true);
  });
});
