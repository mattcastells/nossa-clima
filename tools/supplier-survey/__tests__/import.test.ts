import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { DatabaseState, ItemState, StoreState } from '../core/types.ts';
import { readAmbaWorkbook } from '../import/ambaSheet.ts';
import { deterministicUuid, itemUuid, storeUuid } from '../import/ids.ts';
import { buildImportPlan } from '../import/plan.ts';
import { renderImportSql } from '../import/sql.ts';
import { readWorkbook } from '../import/xlsx.ts';
import { readZip } from '../import/zip.ts';

/** La planilla real vive en la raiz del repo. */
const WORKBOOK_PATH = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')),
  '..',
  '..',
  '..',
  'Tiendas_insumos_refrigeracion_AMBA.xlsx',
);

const store = (overrides: Partial<StoreState>): StoreState => ({
  id: 'store-1',
  name: 'Pizarro',
  description: '8:30-12:30 - 14-18',
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

const item = (overrides: Partial<ItemState>): ItemState => ({
  id: 'item-1',
  name: 'Caño 1/4 (mt)',
  brand: null,
  sku: null,
  category: 'Refrigeración',
  unit: 'mt',
  variantLabel: null,
  archivedAt: null,
  ...overrides,
});

const state = (overrides: Partial<DatabaseState> = {}): DatabaseState => ({
  stores: [],
  items: [],
  priceRefs: new Set(),
  knownDomains: new Set(),
  dismissedDomains: new Set(),
  origin: 'test',
  ...overrides,
});

describe('ids deterministicos', () => {
  it('la misma entrada da siempre el mismo uuid', () => {
    expect(storeUuid('friosur.com.ar')).toBe(storeUuid('friosur.com.ar'));
    expect(itemUuid('a|b|c')).toBe(itemUuid('a|b|c'));
  });

  it('entradas distintas dan uuids distintos', () => {
    expect(storeUuid('a.com.ar')).not.toBe(storeUuid('b.com.ar'));
  });

  it('tiene forma de uuid v5', () => {
    expect(deterministicUuid('x', 'y')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('lector de zip', () => {
  it('rechaza un archivo que no es zip', () => {
    expect(() => readZip(Buffer.from('esto no es un zip'))).toThrow(/no es un ZIP/i);
  });
});

describe('lectura de la planilla real', () => {
  const workbook = readAmbaWorkbook(readWorkbook(readFileSync(WORKBOOK_PATH)));

  it('lee las cuatro hojas de datos sin avisos', () => {
    expect(workbook.warnings).toEqual([]);
    expect(workbook.surveyDate?.slice(0, 10)).toBe('2026-09-08');
  });

  it('lee las 33 empresas de las tres hojas de tiendas', () => {
    expect(workbook.companies).toHaveLength(33);
    expect(workbook.companies.filter((entry) => entry.tier === 'con-precios')).toHaveLength(15);
    expect(workbook.companies.filter((entry) => entry.tier === 'sin-precios-web')).toHaveLength(9);
    expect(workbook.companies.filter((entry) => entry.tier === 'fuera-amba')).toHaveLength(9);
  });

  it('no se come Totaline por empezar con "total"', () => {
    expect(workbook.companies.some((entry) => entry.company.name === 'Totaline Argentina')).toBe(true);
  });

  it('lee los 118 precios y corta antes del bloque RESUMEN', () => {
    expect(workbook.prices).toHaveLength(118);
    expect(workbook.prices.every((price) => price.publishedPrice > 0)).toBe(true);
    expect(workbook.prices.some((price) => price.storeName === 'Items relevados')).toBe(false);
  });

  it('calcula el precio unitario del rollo', () => {
    const roll = workbook.prices.find(
      (price) => price.itemName === 'Cano de cobre 1/4"' && price.variantLabel === 'Rollo 15 m' && price.storeName === 'FM Refrigeracion',
    );

    expect(roll?.publishedPrice).toBe(83421);
    expect(roll?.quantityPerUnit).toBe(15);
    expect(roll?.unitPrice).toBe(5561.4);
  });

  it('extrae telefonos de la columna de contacto', () => {
    const fm = workbook.companies.find((entry) => entry.company.name === 'FM Refrigeracion');
    expect(fm?.company.phone).toBe('11 6422-8162');
    expect(fm?.company.canonicalDomain).toBe('fmrefrigeracion.com.ar');
  });
});

describe('plan de importacion', () => {
  const workbook = readAmbaWorkbook(readWorkbook(readFileSync(WORKBOOK_PATH)));

  it('las tiendas con precios entran al catalogo y el resto queda a revision', () => {
    const plan = buildImportPlan(workbook, state());

    expect(plan.storeInserts).toHaveLength(15);
    expect(plan.candidates).toHaveLength(18);
    expect(plan.priceInserts).toHaveLength(118);
  });

  it('reconoce una tienda que ya estaba, aunque el nombre cambie', () => {
    // "Refrigeracion Pizarro" de la planilla es el "Pizarro" que ya esta
    // cargado: misma altura de la misma avenida.
    const plan = buildImportPlan(workbook, state({ stores: [store({ id: 'pizarro-existente' })] }));

    expect(plan.storeUpdates).toHaveLength(1);
    expect(plan.storeUpdates[0]?.storeId).toBe('pizarro-existente');
    expect(plan.storeUpdates[0]?.changes.website).toBe('https://pizarroref.com.ar/');

    // No se crea una segunda tienda Pizarro.
    expect(plan.storeInserts.some((entry) => /pizarro/i.test(entry.name))).toBe(false);
  });

  it('no pisa el horario ni las notas del tecnico', () => {
    const plan = buildImportPlan(workbook, state({ stores: [store({ id: 'pizarro-existente' })] }));
    const update = plan.storeUpdates[0];

    expect(update?.changes.description).toBeUndefined();
    expect(update?.changes.notes).toBeUndefined();
    expect(update?.conflicts.some((conflict) => conflict.fieldName === 'name')).toBe(true);
  });

  it('reusa los materiales que ya estan en el catalogo', () => {
    const plan = buildImportPlan(
      workbook,
      state({
        items: [
          item({ id: 'cano-14', name: 'Caño 1/4 (mt)', unit: 'mt' }),
          item({ id: 'tpr-3x15', name: 'Cable TPR 3x1,5 (mt)', unit: 'mt' }),
        ],
      }),
    );

    const reusedIds = new Set(plan.priceInserts.map((price) => price.itemId));
    expect(reusedIds.has('cano-14')).toBe(true);
    expect(reusedIds.has('tpr-3x15')).toBe(true);
  });

  it('NO manda el precio del cable 3x2,5 al item 3x1,5', () => {
    const plan = buildImportPlan(workbook, state({ items: [item({ id: 'tpr-3x15', name: 'Cable TPR 3x1,5 (mt)', unit: 'mt' })] }));

    const wrong = plan.priceInserts.filter(
      (price) => price.itemId === 'tpr-3x15' && /3x2,5/.test(price.itemName),
    );
    expect(wrong).toEqual([]);
  });

  it('separa el rollo del metro suelto para no pisar el precio', () => {
    const plan = buildImportPlan(workbook, state({ items: [item({ id: 'cano-14', name: 'Caño 1/4 (mt)', unit: 'mt' })] }));

    const fmPrices = plan.priceInserts.filter(
      (price) => price.storeName === 'FM Refrigeracion' && price.itemName === 'Cano de cobre 1/4"',
    );

    // Dos observaciones, dos items distintos: si compartieran item, la vista de
    // ultimo precio elegiria una al azar.
    expect(fmPrices).toHaveLength(2);
    expect(new Set(fmPrices.map((price) => price.itemId)).size).toBe(2);
  });

  it('guarda el precio unitario y deja el publicado en las notas', () => {
    const plan = buildImportPlan(workbook, state());
    const roll = plan.priceInserts.find(
      (price) => price.storeName === 'FM Refrigeracion' && price.quantityReference === 'Rollo 15 m' && /cobre 1\/4/i.test(price.itemName),
    );

    expect(roll?.price).toBe(5561.4);
    expect(roll?.notes).toContain('83.421');
  });

  it('no reinserta una observacion ya registrada', () => {
    const first = buildImportPlan(workbook, state());
    const refs = new Set(first.priceInserts.map((price) => price.externalRef));

    const second = buildImportPlan(workbook, state({ priceRefs: refs }));
    expect(second.priceInserts).toEqual([]);
  });

  it('respeta lo que se descarto en una revision anterior', () => {
    const plan = buildImportPlan(workbook, state({ dismissedDomains: new Set(['totaline.com.ar']) }));
    expect(plan.candidates.some((candidate) => candidate.company.canonicalDomain === 'totaline.com.ar')).toBe(false);
  });

  it('es idempotente: la misma planilla da el mismo id de carga', () => {
    const a = buildImportPlan(workbook, state(), 'planilla.xlsx');
    const b = buildImportPlan(workbook, state(), 'planilla.xlsx');
    expect(a.runId).toBe(b.runId);
    expect(a.storeInserts.map((entry) => entry.id)).toEqual(b.storeInserts.map((entry) => entry.id));
  });
});

describe('SQL del import', () => {
  const workbook = readAmbaWorkbook(readWorkbook(readFileSync(WORKBOOK_PATH)));
  const plan = buildImportPlan(workbook, state({ stores: [store({ id: 'pizarro-existente' })] }));
  const sql = renderImportSql(plan, { sourceName: 'relevamiento_amba', sourceFile: 'planilla.xlsx' });

  it('abre y cierra transaccion, y setea la identidad para los triggers', () => {
    expect(sql).toContain('begin;');
    expect(sql).toContain('commit;');
    expect(sql).toContain("set_config('request.jwt.claim.sub'");
  });

  it('todo insert lleva su on conflict', () => {
    const inserts = sql.split('\n').filter((line) => line.startsWith('insert into')).length;
    const guards = sql.split('\n').filter((line) => line.startsWith('on conflict')).length;
    expect(guards).toBe(inserts);
  });

  it('marca el origen de las filas que crea', () => {
    expect(sql).toContain(`'relevamiento_amba', 'automated'`);
    expect(sql).toContain(`'scraper'`);
  });

  it('las comillas del script quedan balanceadas', () => {
    // Por linea no sirve: `notes` es un literal multilinea y abre en una linea
    // y cierra en otra. En el archivo entero, en cambio, cada literal abre y
    // cierra, y cada comilla del texto viaja duplicada.
    const quotes = (sql.match(/'/g) ?? []).length;
    expect(quotes % 2).toBe(0);
  });

  it('escapa las comillas simples que vienen en los datos', () => {
    const planWithQuote = buildImportPlan(
      {
        ...workbook,
        companies: [
          {
            ...(workbook.companies[0] as NonNullable<(typeof workbook.companies)[number]>),
            company: {
              ...(workbook.companies[0] as NonNullable<(typeof workbook.companies)[number]>).company,
              name: "Refrigeracion D'Angelo",
            },
          },
        ],
        prices: [],
      },
      state(),
    );

    expect(renderImportSql(planWithQuote, { sourceName: 'x', sourceFile: 'y' })).toContain("D''Angelo");
  });
});
