import { describe, expect, it } from 'vitest';

import type { ItemState, NormalizedCompany, NormalizedProduct, StoreState } from '../core/types.ts';
import { companyFingerprint, priceObservationRef, productKey } from '../dedupe/fingerprint.ts';
import { matchCompany, matchItem, AUTO_MATCH_THRESHOLD, ITEM_MATCH_THRESHOLD } from '../dedupe/match.ts';
import { jaroWinkler, nameSimilarity, tokenOverlap } from '../dedupe/similarity.ts';

const store = (overrides: Partial<StoreState>): StoreState => ({
  id: 'store-1',
  name: 'Pizarro',
  description: null,
  address: 'Av. de los Constituyentes 3729',
  phone: '1145712411',
  email: null,
  website: null,
  notes: null,
  canonicalDomain: null,
  source: 'manual',
  sourceType: 'manual',
  archivedAt: null,
  scrapedSnapshot: null,
  ...overrides,
});

const company = (overrides: Partial<NormalizedCompany>): NormalizedCompany => ({
  name: 'Pizarro',
  description: null,
  address: null,
  phone: null,
  email: null,
  website: 'https://pizarro.com.ar',
  canonicalDomain: 'pizarro.com.ar',
  categories: [],
  fingerprint: 'fp',
  relevanceScore: 80,
  sourceUrl: 'https://pizarro.com.ar',
  scrapedAt: '2026-09-08T12:00:00.000Z',
  provenance: {},
  raw: {},
  ...overrides,
});

describe('fingerprints', () => {
  it('la huella de empresa es estable entre corridas', () => {
    expect(companyFingerprint('a.com.ar', 'Frio Sur')).toBe(companyFingerprint('a.com.ar', 'FRÍO SUR S.R.L.'));
  });

  it('distingue empresas distintas en el mismo dominio', () => {
    expect(companyFingerprint('a.com.ar', 'Frio Sur')).not.toBe(companyFingerprint('a.com.ar', 'Calor Norte'));
  });

  it('la huella de precio cambia solo si cambia el precio', () => {
    const key = productKey('Cano de cobre 1/4', null);
    expect(priceObservationRef('a.com.ar', key, 1000, 'ARS')).toBe(priceObservationRef('a.com.ar', key, 1000, 'ARS'));
    expect(priceObservationRef('a.com.ar', key, 1000, 'ARS')).not.toBe(priceObservationRef('a.com.ar', key, 1100, 'ARS'));
    expect(priceObservationRef('a.com.ar', key, 1000, 'ARS')).not.toBe(priceObservationRef('a.com.ar', key, 1000, 'USD'));
  });

  it('el SKU manda sobre el nombre como clave de producto', () => {
    expect(productKey('Nombre A', 'SKU-1')).toBe(productKey('Nombre B', 'sku-1'));
    expect(productKey('Nombre A', null)).not.toBe(productKey('Nombre B', null));
  });
});

describe('similitud', () => {
  it('jaroWinkler premia prefijos iguales', () => {
    expect(jaroWinkler('frio sur', 'frio sur refrigeracion')).toBeGreaterThan(0.8);
    expect(jaroWinkler('frio sur', 'calor norte')).toBeLessThan(0.6);
  });

  it('tokenOverlap tolera el reordenamiento de palabras', () => {
    expect(tokenOverlap('rial materiales electricos', 'materiales electricos rial')).toBe(1);
  });

  it('nameSimilarity toma el mejor de los dos', () => {
    expect(nameSimilarity('rial materiales electricos', 'materiales electricos rial')).toBe(1);
    expect(nameSimilarity('', 'algo')).toBe(0);
  });
});

describe('matchCompany', () => {
  const stores = [
    store({ id: 'con-dominio', name: 'Frio Sur', canonicalDomain: 'friosur.com.ar', phone: null, address: null }),
    store({ id: 'pizarro', name: 'Pizarro', phone: '1145712411', address: 'Av. de los Constituyentes 3729' }),
  ];

  it('el dominio da certeza', () => {
    const result = matchCompany(company({ canonicalDomain: 'friosur.com.ar' }), stores);
    expect(result.storeId).toBe('con-dominio');
    expect(result.confidence).toBe(100);
  });

  it('el telefono tambien alcanza para actualizar', () => {
    const result = matchCompany(company({ canonicalDomain: 'otro.com.ar', name: 'Otro nombre', phone: '11 4571-2411' }), stores);
    expect(result.storeId).toBe('pizarro');
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });

  it('nombre igual y misma altura de calle alcanza para actualizar', () => {
    const result = matchCompany(
      company({ canonicalDomain: 'otro.com.ar', name: 'Pizarro', address: 'Constituyentes 3729, CABA' }),
      stores,
    );
    expect(result.storeId).toBe('pizarro');
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });

  it('reconoce la misma tienda por direccion aunque el nombre cambie', () => {
    // Caso real de la planilla AMBA: "Refrigeracion Pizarro" contra el
    // "Pizarro" que ya estaba cargado. Como nombres se parecen 0,52, muy por
    // debajo del umbral; lo que los identifica es la altura de la avenida.
    const existing = [
      store({ id: 'pizarro-real', name: 'Pizarro', address: 'Av. de los Constituyentes 3729', phone: '1145712411' }),
    ];

    const result = matchCompany(
      company({
        canonicalDomain: 'pizarroref.com.ar',
        name: 'Refrigeracion Pizarro',
        address: 'Av. de los Constituyentes 3729, CABA',
        phone: null,
      }),
      existing,
    );

    expect(result.storeId).toBe('pizarro-real');
    expect(result.confidence).toBeGreaterThanOrEqual(AUTO_MATCH_THRESHOLD);
  });

  it('misma direccion con nombre distinto queda a revision, no se aplica solo', () => {
    const existing = [store({ id: 'otra', name: 'Ferreteria Central', address: 'Av. de los Constituyentes 3729' })];

    const result = matchCompany(
      company({ canonicalDomain: 'nueva.com.ar', name: 'Distribuidora Austral', address: 'Av. de los Constituyentes 3729, CABA' }),
      existing,
    );

    expect(result.storeId).toBe('otra');
    expect(result.confidence).toBeLessThan(AUTO_MATCH_THRESHOLD);
    expect(result.confidence).toBeGreaterThanOrEqual(40);
  });

  it('la misma altura en calles distintas no es la misma tienda', () => {
    const existing = [store({ id: 'a', name: 'Frio Norte', address: 'Av. Cabildo 3729' })];

    const result = matchCompany(
      company({ canonicalDomain: 'x.com.ar', name: 'Distribuidora Austral', address: 'Av. de los Constituyentes 3729' }),
      existing,
    );

    expect(result.storeId).toBeNull();
  });

  it('una direccion sin altura no identifica nada', () => {
    const existing = [store({ id: 'a', name: 'Frio Norte', address: 'Buenos Aires' })];

    const result = matchCompany(
      company({ canonicalDomain: 'x.com.ar', name: 'Distribuidora Austral', address: 'Buenos Aires' }),
      existing,
    );

    expect(result.storeId).toBeNull();
  });

  it('nombre igual sin direccion queda debajo del umbral automatico', () => {
    const result = matchCompany(company({ canonicalDomain: 'otro.com.ar', name: 'Pizarro', address: null }), stores);
    expect(result.storeId).toBe('pizarro');
    expect(result.confidence).toBeLessThan(AUTO_MATCH_THRESHOLD);
  });

  it('sin coincidencias devuelve null', () => {
    const result = matchCompany(company({ canonicalDomain: 'nuevo.com.ar', name: 'Distribuidora Austral' }), stores);
    expect(result.storeId).toBeNull();
  });

  it('ignora las tiendas archivadas', () => {
    const archived = [store({ id: 'vieja', canonicalDomain: 'friosur.com.ar', archivedAt: '2026-01-01T00:00:00Z' })];
    expect(matchCompany(company({ canonicalDomain: 'friosur.com.ar' }), archived).storeId).toBeNull();
  });
});

const product = (overrides: Partial<NormalizedProduct>): NormalizedProduct => ({
  name: 'Cano de cobre 1/4',
  brand: null,
  sku: null,
  category: null,
  unit: null,
  presentationQuantity: null,
  presentationUnit: null,
  price: 1000,
  currency: 'ARS',
  availability: null,
  canonicalDomain: 'a.com.ar',
  externalRef: 'ref',
  sourceUrl: 'https://a.com.ar/p',
  scrapedAt: '2026-09-08T12:00:00.000Z',
  ...overrides,
});

const item = (overrides: Partial<ItemState>): ItemState => ({
  id: 'item-1',
  name: 'Cano de cobre 1/4',
  brand: null,
  sku: null,
  category: null,
  unit: null,
  variantLabel: null,
  archivedAt: null,
  ...overrides,
});

describe('matchItem', () => {
  it('el SKU da certeza', () => {
    const result = matchItem(product({ sku: 'ABC-1' }), [item({ id: 'x', name: 'Otro', sku: 'abc-1' })]);
    expect(result.itemId).toBe('x');
    expect(result.confidence).toBe(100);
  });

  it('nombre identico supera el umbral', () => {
    const result = matchItem(product({}), [item({})]);
    expect(result.itemId).toBe('item-1');
    expect(result.confidence).toBeGreaterThanOrEqual(ITEM_MATCH_THRESHOLD);
  });

  it('marcas distintas con nombre igual son productos distintos', () => {
    const result = matchItem(product({ brand: 'Sanhua' }), [item({ brand: 'Danfoss' })]);
    expect(result.itemId).toBeNull();
  });

  it('nombre apenas parecido no alcanza', () => {
    const result = matchItem(product({ name: 'Compresor rotativo 9000' }), [item({ name: 'Cano de cobre 1/4' })]);
    expect(result.itemId).toBeNull();
  });
});
