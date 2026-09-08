import { describe, expect, it } from 'vitest';

import type { ItemState } from '../core/types.ts';
import { bestItemNameMatch, ITEM_MATCH_THRESHOLD, matchItem } from '../dedupe/match.ts';
import { compareMeasures, materialMeasures, materialWords } from '../normalize/material.ts';
import { canonicalUnit, unitsMatch } from '../normalize/unit.ts';

describe('materialMeasures', () => {
  it('reconoce fracciones, productos y numeros sueltos', () => {
    expect(materialMeasures('Cano de cobre 1/4"')).toEqual(['1/4']);
    expect(materialMeasures('Cable TPR / tipo taller 3x1,5 mm')).toEqual(['3x1.5']);
    expect(materialMeasures('Mensula reforzada 42 cm')).toEqual(['42']);
  });

  it('ignora el sufijo de unidad: 42 cm y 42 son la misma medida', () => {
    expect(materialMeasures('Mensula 42')).toEqual(materialMeasures('Mensula reforzada 42 cm'));
  });

  it('no confunde la barra de una fraccion con la de un texto', () => {
    // "TPR / tipo" no es una fraccion: no hay digitos alrededor.
    expect(materialMeasures('Cable TPR / tipo taller 5x2,5 mm')).toEqual(['5x2.5']);
  });
});

describe('materialWords', () => {
  it('saca medidas, unidades y conectores', () => {
    expect(materialWords('Cable TPR / tipo taller 3x1,5 mm')).toBe('cable tpr taller');
    expect(materialWords('Caño 1/4 (mt)')).toBe('cano');
  });
});

describe('compareMeasures', () => {
  it('distingue medidas distintas', () => {
    expect(compareMeasures('Manguera cristal 1/4"', 'Manguera cristal 5/8 (mt)')).toBe('different');
    expect(compareMeasures('Cable TPR 3x2,5 mm', 'Cable TPR 3x1,5 (mt)')).toBe('different');
  });

  it('reconoce la misma medida escrita distinto', () => {
    expect(compareMeasures('Cano de cobre 1/4"', 'Caño 1/4 (mt)')).toBe('equal');
  });

  it('marca como parcial lo que es mas especifico', () => {
    expect(compareMeasures('Aislacion 1/4" espesor 6 mm', 'Aislante 1/4')).toBe('subset');
  });

  it('sin medidas decide el nombre', () => {
    expect(compareMeasures('Sellafugas K11', 'Sellafugas')).toBe('subset');
    expect(compareMeasures('Varilla de cobre', 'Varilla para soldar')).toBe('none');
  });
});

describe('canonicalUnit', () => {
  it('unifica las formas de metro que usa la base', () => {
    expect(canonicalUnit('metro')).toBe('mt');
    expect(canonicalUnit('mt')).toBe('mt');
    expect(canonicalUnit('MTS')).toBe('mt');
    expect(unitsMatch('metro', 'mt')).toBe(true);
    expect(unitsMatch('metro', 'tira')).toBe(false);
  });
});

const item = (id: string, name: string, unit: string | null): ItemState => ({
  id,
  name,
  brand: null,
  sku: null,
  category: null,
  unit,
  variantLabel: null,
  archivedAt: null,
});

/** El catalogo real del equipo, tal como esta hoy en la base. */
const CATALOG: ItemState[] = [
  item('cano-14', 'Caño 1/4 (mt)', 'mt'),
  item('cano-12', 'Caño 1/2 (mt)', 'mt'),
  item('cano-38', 'Caño 3/8 (mt)', 'mt'),
  item('tpr-3x15', 'Cable TPR 3x1,5 (mt)', 'mt'),
  item('tpr-5x15', 'Cable TPR 5x1,5 (mt)', 'mt'),
  item('manguera-58', 'Manguera cristal 5/8 (mt)', 'mt'),
  item('mensula-42', 'Ménsula 42', null),
];

describe('bestItemNameMatch', () => {
  it('NO adjudica el cable 3x2,5 al item 3x1,5', () => {
    // Este es el bug que se detecto importando la planilla real: los nombres
    // dan 0,87 de similitud y son cables distintos. El precio del 3x2,5 en el
    // item del 3x1,5 sale impreso en un presupuesto.
    const result = bestItemNameMatch('Cable TPR / tipo taller 3x2,5 mm', 'mt', CATALOG);
    expect(result.itemId).not.toBe('tpr-3x15');
    expect(result.itemId).not.toBe('tpr-5x15');
  });

  it('NO adjudica la manguera de 1/4 a la de 5/8', () => {
    const result = bestItemNameMatch('Manguera cristal 1/4"', 'mt', CATALOG);
    expect(result.itemId).not.toBe('manguera-58');
    expect(result.confidence).toBeLessThan(ITEM_MATCH_THRESHOLD);
  });

  it('compartir la medida no alcanza si el material es otro', () => {
    // 'Manguera cristal 1/4"' y "Caño 1/4" son los dos de 1/4.
    expect(bestItemNameMatch('Manguera cristal 1/4"', 'mt', CATALOG).itemId).toBeNull();
  });

  it('NO confunde canos de distinta medida', () => {
    expect(bestItemNameMatch('Cano de cobre 5/8"', 'mt', CATALOG).itemId).not.toBe('cano-12');
  });

  it('SI reconoce el mismo material escrito distinto', () => {
    const result = bestItemNameMatch('Cano de cobre 1/4"', 'metro', CATALOG);
    expect(result.itemId).toBe('cano-14');
    expect(result.confidence).toBeGreaterThanOrEqual(ITEM_MATCH_THRESHOLD);
  });

  it('SI reconoce el cable de la misma seccion', () => {
    const result = bestItemNameMatch('Cable TPR / tipo taller 3x1,5 mm', 'metro', CATALOG);
    expect(result.itemId).toBe('tpr-3x15');
    expect(result.confidence).toBeGreaterThanOrEqual(ITEM_MATCH_THRESHOLD);
  });

  it('la manguera de 5/8 si coincide', () => {
    expect(bestItemNameMatch('Manguera cristal 5/8"', 'metro', CATALOG).itemId).toBe('manguera-58');
  });

  it('una medida mas especifica queda debajo del umbral automatico', () => {
    const result = bestItemNameMatch('Ménsula reforzada 42 cm x 2', 'unidad', CATALOG);
    if (result.itemId !== null) expect(result.confidence).toBeLessThan(ITEM_MATCH_THRESHOLD);
  });
});

describe('matchItem con medidas', () => {
  const product = (name: string) => ({
    name,
    brand: null,
    sku: null,
    category: null,
    unit: 'mt',
    presentationQuantity: null,
    presentationUnit: null,
    price: 1000,
    currency: 'ARS',
    availability: null,
    canonicalDomain: 'a.com.ar',
    externalRef: 'ref',
    sourceUrl: 'https://a.com.ar/p',
    scrapedAt: '2026-09-08T12:00:00.000Z',
  });

  it('el scraper tampoco puede cruzar medidas', () => {
    expect(matchItem(product('Cable TPR 3x2,5 mm'), CATALOG).itemId).toBeNull();
    expect(matchItem(product('Manguera cristal 1/2"'), CATALOG).itemId).toBeNull();
  });

  it('pero si reconoce la medida correcta', () => {
    expect(matchItem(product('Caño de cobre 3/8'), CATALOG).itemId).toBe('cano-38');
  });
});
