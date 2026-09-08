/**
 * JSON-LD schema.org: la fuente de mayor calidad, cuando existe.
 *
 * Es dato estructurado que el propio sitio publica para Google, asi que no se
 * rompe cuando cambian el CSS. Tiendanube, WooCommerce, VTEX y Shopify — que
 * es casi todo el comercio argentino — lo emiten por defecto.
 */

import { field, type RawCompany, type RawProduct, type Provenance } from '../../core/types.ts';
import { cleanText } from '../../normalize/text.ts';
import { detectCurrency, parsePrice } from '../../normalize/price.ts';
import { hasJsonLdType } from '../html.ts';
import type { CompanyStrategy, PageContext, ProductStrategy } from '../types.ts';

const ORGANIZATION_TYPES = [
  'Organization',
  'LocalBusiness',
  'Store',
  'HomeAndConstructionBusiness',
  'HardwareStore',
  'Corporation',
  'OnlineStore',
  'HVACBusiness',
];

const PRODUCT_TYPES = ['Product', 'ProductModel', 'IndividualProduct'];

const asString = (value: unknown): string | null => {
  if (typeof value === 'string') return cleanText(value);
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = asString(entry);
      if (found) return found;
    }
  }
  return null;
};

/** `address` puede ser texto suelto o un PostalAddress con partes. */
const readAddress = (value: unknown): string | null => {
  const direct = asString(value);
  if (direct) return direct;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

  const address = value as Record<string, unknown>;
  const parts = [
    asString(address.streetAddress),
    asString(address.addressLocality),
    asString(address.addressRegion),
    asString(address.postalCode),
  ].filter((part): part is string => part !== null && part.length > 0);

  return parts.length > 0 ? parts.join(', ') : null;
};

/** `contactPoint` puede ser objeto o array; buscamos el primer telefono. */
const readContactPhone = (value: unknown): string | null => {
  const entries = Array.isArray(value) ? value : [value];

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue;
    const phone = asString((entry as Record<string, unknown>).telephone);
    if (phone) return phone;
  }

  return null;
};

const provenanceFor = (page: PageContext, confidence: number): Provenance => ({
  sourceUrl: page.url,
  strategy: 'json-ld',
  confidence,
  observedAt: page.scrapedAt,
});

export const jsonLdCompanyStrategy: CompanyStrategy = {
  name: 'json-ld',
  confidence: 0.95,

  canHandle: (page) => page.jsonLdNodes.some((node) => hasJsonLdType(node, ORGANIZATION_TYPES)),

  extract: (page) => {
    const company: RawCompany = {};
    const provenance = provenanceFor(page, 0.95);

    for (const node of page.jsonLdNodes) {
      if (!hasJsonLdType(node, ORGANIZATION_TYPES)) continue;

      const name = asString(node.name) ?? asString(node.legalName);
      if (name && !company.name) company.name = field(name, provenance);

      const legalName = asString(node.legalName);
      if (legalName && !company.legalName) company.legalName = field(legalName, provenance);

      const description = asString(node.description);
      if (description && !company.description) company.description = field(description, provenance);

      const address = readAddress(node.address);
      if (address && !company.address) company.address = field(address, provenance);

      const phone = asString(node.telephone) ?? readContactPhone(node.contactPoint);
      if (phone && !company.phone) company.phone = field(phone, provenance);

      const email = asString(node.email);
      if (email && !company.email) company.email = field(email, provenance);

      const website = asString(node.url);
      if (website && !company.website) company.website = field(website, provenance);
    }

    return company;
  },
};

/** Precio de un nodo Product: `offers` puede ser objeto, array o AggregateOffer. */
const readOffer = (value: unknown): { price: number | null; currency: string | null; availability: string | null } => {
  const entries = Array.isArray(value) ? value : [value];

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object') continue;
    const offer = entry as Record<string, unknown>;

    // AggregateOffer anida las ofertas reales.
    if ('offers' in offer && !('price' in offer) && !('lowPrice' in offer)) {
      const nested = readOffer(offer.offers);
      if (nested.price !== null) return nested;
    }

    const rawPrice = offer.price ?? offer.lowPrice;
    // JSON-LD manda el precio en formato ingles por especificacion.
    const price = typeof rawPrice === 'number' ? parsePrice(rawPrice) : parsePrice(asString(rawPrice), 'en');
    if (price === null) continue;

    const currency = asString(offer.priceCurrency);
    const availability = asString(offer.availability);

    return { price, currency, availability };
  }

  return { price: null, currency: null, availability: null };
};

export const jsonLdProductStrategy: ProductStrategy = {
  name: 'json-ld',
  confidence: 0.95,

  canHandle: (page) => page.jsonLdNodes.some((node) => hasJsonLdType(node, PRODUCT_TYPES)),

  extract: (page) => {
    const products: RawProduct[] = [];
    const provenance = provenanceFor(page, 0.95);

    for (const node of page.jsonLdNodes) {
      if (!hasJsonLdType(node, PRODUCT_TYPES)) continue;

      const name = asString(node.name);
      if (!name) continue;

      const product: RawProduct = { name: field(name, provenance) };

      const brand = asString(node.brand);
      if (brand) product.brand = field(brand, provenance);

      const sku = asString(node.sku) ?? asString(node.mpn) ?? asString(node.productID);
      if (sku) product.sku = field(sku, provenance);

      const category = asString(node.category);
      if (category) product.category = field(category, provenance);

      const { price, currency, availability } = readOffer(node.offers);
      if (price !== null) {
        product.price = field(price, provenance);
        product.currency = field(currency ?? detectCurrency(asString(node.offers) ?? ''), provenance);
      }
      if (availability) {
        // schema.org devuelve URLs: http://schema.org/InStock
        product.availability = field(availability.split('/').pop() ?? availability, provenance);
      }

      products.push(product);
    }

    return products;
  },
};
