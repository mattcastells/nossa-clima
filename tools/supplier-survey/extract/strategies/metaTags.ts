/**
 * Open Graph, meta tags y `<title>`.
 *
 * Segunda linea despues de JSON-LD: casi todo sitio tiene `og:site_name` y
 * `description`, y son estables porque los consume Facebook/WhatsApp.
 */

import { field, type RawCompany, type RawProduct, type Provenance } from '../../core/types.ts';
import { parsePrice } from '../../normalize/price.ts';
import { cleanText, companyNameFromTitle } from '../../normalize/text.ts';
import { extractTitle } from '../html.ts';
import type { CompanyStrategy, PageContext, ProductStrategy } from '../types.ts';

const provenanceFor = (page: PageContext, confidence: number): Provenance => ({
  sourceUrl: page.url,
  strategy: 'meta-tags',
  confidence,
  observedAt: page.scrapedAt,
});

export const metaTagsCompanyStrategy: CompanyStrategy = {
  name: 'meta-tags',
  confidence: 0.7,

  canHandle: (page) => Object.keys(page.metaTags).length > 0 || extractTitle(page.html) !== null,

  extract: (page) => {
    const company: RawCompany = {};
    const provenance = provenanceFor(page, 0.7);
    const meta = page.metaTags;

    // og:site_name es el nombre del sitio; og:title suele ser el de la pagina.
    const name =
      cleanText(meta['og:site_name']) ??
      cleanText(meta['application-name']) ??
      companyNameFromTitle(cleanText(meta['og:title'])) ??
      companyNameFromTitle(extractTitle(page.html));

    if (name) company.name = field(name, provenance);

    const description = cleanText(meta['og:description']) ?? cleanText(meta.description);
    if (description) company.description = field(description, provenance);

    const website = cleanText(meta['og:url']);
    if (website) company.website = field(website, provenance);

    // Schema.org por microdata en meta tags: itemprop="telephone".
    const phone = cleanText(meta.telephone) ?? cleanText(meta['business:contact_data:phone_number']);
    if (phone) company.phone = field(phone, provenance);

    const email = cleanText(meta.email) ?? cleanText(meta['business:contact_data:email']);
    if (email) company.email = field(email, provenance);

    const addressParts = [
      cleanText(meta['business:contact_data:street_address']),
      cleanText(meta['business:contact_data:locality']),
      cleanText(meta['business:contact_data:region']),
    ].filter((part): part is string => part !== null);

    if (addressParts.length > 0) company.address = field(addressParts.join(', '), provenance);

    return company;
  },
};

/**
 * Precio en meta tags de producto (`product:price:amount`). Solo aplica en
 * paginas de ficha; una home no las tiene.
 */
export const metaTagsProductStrategy: ProductStrategy = {
  name: 'meta-tags',
  confidence: 0.65,

  canHandle: (page) => 'product:price:amount' in page.metaTags || 'og:price:amount' in page.metaTags,

  extract: (page) => {
    const provenance = provenanceFor(page, 0.65);
    const meta = page.metaTags;

    const name = cleanText(meta['og:title']) ?? companyNameFromTitle(extractTitle(page.html));
    if (!name) return [];

    // Estos meta tags usan formato ingles por especificacion de Open Graph.
    const price = parsePrice(meta['product:price:amount'] ?? meta['og:price:amount'], 'en');
    if (price === null) return [];

    const product: RawProduct = {
      name: field(name, provenance),
      price: field(price, provenance),
      currency: field(cleanText(meta['product:price:currency'] ?? meta['og:price:currency']) ?? 'ARS', provenance),
    };

    const brand = cleanText(meta['product:brand']);
    if (brand) product.brand = field(brand, provenance);

    const sku = cleanText(meta['product:retailer_item_id']);
    if (sku) product.sku = field(sku, provenance);

    const availability = cleanText(meta['product:availability'] ?? meta['og:availability']);
    if (availability) product.availability = field(availability, provenance);

    return [product];
  },
};
