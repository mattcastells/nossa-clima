/**
 * Microdatos schema.org (`itemscope` / `itemprop`).
 *
 * Es el formato que usan los sitios que nunca migraron a JSON-LD. Menos comodo
 * de leer, pero sigue siendo dato estructurado que el sitio declara a
 * proposito.
 *
 * Los precios salen SOLO de aca o de JSON-LD. Nunca de un regex sobre el texto
 * visible: un precio mal leido termina en el informe que ve un cliente, y
 * "$1.234" en una promo tachada es indistinguible del precio real sin estructura.
 */

import { field, type RawCompany, type RawProduct, type Provenance } from '../../core/types.ts';
import { parsePrice } from '../../normalize/price.ts';
import { cleanText } from '../../normalize/text.ts';
import { visibleText } from '../html.ts';
import type { CompanyStrategy, PageContext, ProductStrategy } from '../types.ts';

const provenanceFor = (page: PageContext, confidence: number): Provenance => ({
  sourceUrl: page.url,
  strategy: 'microdata',
  confidence,
  observedAt: page.scrapedAt,
});

interface MicroItem {
  prop: string;
  value: string;
  /** Posicion en el HTML: sirve para agrupar props del mismo producto. */
  index: number;
}

const ATTR_VALUE = /(?:content|value|datetime)\s*=\s*("([^"]*)"|'([^']*)')/i;
const ITEMPROP = /itemprop\s*=\s*("([^"]*)"|'([^']*)')/i;

/**
 * Todos los `itemprop` del documento con su valor.
 * El valor sale del atributo `content` cuando existe (que es lo que la spec
 * pide para datos que no se muestran tal cual, como los precios) y del texto
 * del elemento cuando no.
 */
const collectItemProps = (html: string): MicroItem[] => {
  const items: MicroItem[] = [];

  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*itemprop[^>]*)>/gi)) {
    const attrs = match[2] ?? '';
    const propMatch = attrs.match(ITEMPROP);
    const prop = (propMatch?.[2] ?? propMatch?.[3] ?? '').trim().toLowerCase();
    if (!prop) continue;

    const index = match.index ?? 0;
    const attrMatch = attrs.match(ATTR_VALUE);
    const attrValue = attrMatch?.[2] ?? attrMatch?.[3] ?? null;

    if (attrValue !== null) {
      const value = cleanText(attrValue);
      if (value) items.push({ prop, value, index });
      continue;
    }

    // Sin `content`: tomamos el texto del elemento, acotado para no arrastrar
    // media pagina si el markup no cierra bien.
    const tagName = match[1] ?? '';
    const rest = html.slice(index);
    const closing = new RegExp(`</${tagName}>`, 'i').exec(rest);
    const inner = closing ? rest.slice(match[0].length, closing.index) : '';
    const value = cleanText(visibleText(inner));

    if (value && value.length <= 300) items.push({ prop, value, index });
  }

  return items;
};

const firstProp = (items: readonly MicroItem[], names: readonly string[]): string | null => {
  for (const name of names) {
    const found = items.find((item) => item.prop === name);
    if (found) return found.value;
  }
  return null;
};

export const microdataCompanyStrategy: CompanyStrategy = {
  name: 'microdata',
  confidence: 0.8,

  canHandle: (page) => /itemprop\s*=/i.test(page.html),

  extract: (page) => {
    const items = collectItemProps(page.html);
    if (items.length === 0) return {};

    const company: RawCompany = {};
    const provenance = provenanceFor(page, 0.8);

    const name = firstProp(items, ['legalname', 'name']);
    if (name) company.name = field(name, provenance);

    const phone = firstProp(items, ['telephone', 'phone']);
    if (phone) company.phone = field(phone, provenance);

    const email = firstProp(items, ['email']);
    if (email) company.email = field(email, provenance);

    const street = firstProp(items, ['streetaddress']);
    const locality = firstProp(items, ['addresslocality']);
    const addressParts = [street, locality].filter((part): part is string => part !== null);
    const address = addressParts.length > 0 ? addressParts.join(', ') : firstProp(items, ['address']);
    if (address) company.address = field(address, provenance);

    const description = firstProp(items, ['description']);
    if (description) company.description = field(description, provenance);

    return company;
  },
};

/**
 * Agrupa props consecutivas en productos. Un listado emite
 * name/price/name/price...; cada `name` abre un producto nuevo.
 */
const groupProducts = (items: readonly MicroItem[]): Array<Map<string, string>> => {
  const ordered = [...items].sort((a, b) => a.index - b.index);
  const groups: Array<Map<string, string>> = [];
  let current: Map<string, string> | null = null;

  for (const item of ordered) {
    if (item.prop === 'name') {
      current = new Map([['name', item.value]]);
      groups.push(current);
      continue;
    }
    if (current && !current.has(item.prop)) current.set(item.prop, item.value);
  }

  return groups;
};

export const microdataProductStrategy: ProductStrategy = {
  name: 'microdata',
  confidence: 0.75,

  canHandle: (page) => /itemprop\s*=\s*["']price["']/i.test(page.html),

  extract: (page) => {
    const groups = groupProducts(collectItemProps(page.html));
    const provenance = provenanceFor(page, 0.75);
    const products: RawProduct[] = [];

    for (const group of groups) {
      const name = group.get('name');
      const rawPrice = group.get('price');
      if (!name || !rawPrice) continue;

      // Microdatos con `content` usan formato ingles; el texto visible, el local.
      const price = parsePrice(rawPrice, /^\d+(\.\d{1,2})?$/.test(rawPrice) ? 'en' : 'es');
      if (price === null) continue;

      const product: RawProduct = {
        name: field(name, provenance),
        price: field(price, provenance),
        currency: field(group.get('pricecurrency') ?? 'ARS', provenance),
      };

      const brand = group.get('brand');
      if (brand) product.brand = field(brand, provenance);

      const sku = group.get('sku') ?? group.get('mpn') ?? group.get('productid');
      if (sku) product.sku = field(sku, provenance);

      const category = group.get('category');
      if (category) product.category = field(category, provenance);

      const availability = group.get('availability');
      if (availability) product.availability = field(availability.split('/').pop() ?? availability, provenance);

      products.push(product);
    }

    return products;
  },
};
