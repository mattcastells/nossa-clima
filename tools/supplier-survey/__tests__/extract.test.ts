import { describe, expect, it } from 'vitest';

import { buildPageContext } from '../extract/scrapeSite.ts';
import {
  extractJsonLd,
  extractLinks,
  extractMetaTags,
  extractTitle,
  findEmails,
  flattenJsonLd,
  hasJsonLdType,
  visibleText,
} from '../extract/html.ts';
import { extractCompany, extractProducts, mergeCompanies } from '../extract/registry.ts';
import { jsonLdCompanyStrategy, jsonLdProductStrategy } from '../extract/strategies/jsonLd.ts';
import { metaTagsCompanyStrategy } from '../extract/strategies/metaTags.ts';
import { microdataProductStrategy } from '../extract/strategies/microdata.ts';
import { field } from '../core/types.ts';

const AT = '2026-09-08T12:00:00.000Z';

describe('html', () => {
  it('visibleText saca scripts, estilos y tags', () => {
    const html = '<html><head><style>a{}</style><script>var x=1</script></head><body><p>Hola</p><p>Mundo</p></body></html>';
    expect(visibleText(html)).toBe('Hola\nMundo');
  });

  it('extractTitle lee el titulo', () => {
    expect(extractTitle('<title>  Frio  Sur </title>')).toBe('Frio Sur');
    expect(extractTitle('<html></html>')).toBeNull();
  });

  it('extractMetaTags indexa por name y property', () => {
    const html = `<meta property="og:site_name" content="Frio Sur"><meta name="description" content="Insumos">`;
    expect(extractMetaTags(html)).toEqual({ 'og:site_name': 'Frio Sur', description: 'Insumos' });
  });

  it('extractMetaTags soporta comillas simples y atributos sin comillas', () => {
    const html = `<meta name='telephone' content='11 4571-2411'><meta name=email content=a@b.com>`;
    expect(extractMetaTags(html)).toEqual({ telephone: '11 4571-2411', email: 'a@b.com' });
  });

  it('extractJsonLd ignora bloques rotos sin fallar', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Store","name":"A"}</script>
      <script type="application/ld+json">{ roto ]</script>
      <script type="application/ld+json">{"@type":"Product","name":"B"}</script>`;
    expect(extractJsonLd(html)).toHaveLength(2);
  });

  it('flattenJsonLd aplana @graph y arrays', () => {
    const nodes = flattenJsonLd([{ '@graph': [{ '@type': 'Store', name: 'A' }, { '@type': 'Product', name: 'B' }] }]);
    expect(nodes).toHaveLength(2);
  });

  it('hasJsonLdType acepta @type array', () => {
    expect(hasJsonLdType({ '@type': ['Organization', 'Store'] }, ['store'])).toBe(true);
    expect(hasJsonLdType({ '@type': 'Product' }, ['Store'])).toBe(false);
  });

  it('extractLinks devuelve href y texto', () => {
    expect(extractLinks('<a href="/contacto">Contactanos</a>')).toEqual([{ href: '/contacto', text: 'Contactanos' }]);
  });

  it('findEmails filtra assets y direcciones de sistema', () => {
    const html = 'ventas@friosur.com.ar noreply@friosur.com.ar logo@2x.png a@sentry.io';
    expect(findEmails(html)).toEqual(['ventas@friosur.com.ar']);
  });
});

describe('estrategia json-ld', () => {
  const html = `
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Frio Sur",
      "telephone": "+54 11 4571-2411",
      "email": "ventas@friosur.com.ar",
      "url": "https://friosur.com.ar",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "Av. Rivadavia 2300",
        "addressLocality": "CABA"
      }
    }
    </script>`;

  it('extrae la empresa con direccion armada', () => {
    const page = buildPageContext('https://friosur.com.ar', html, AT);
    const company = jsonLdCompanyStrategy.extract(page);

    expect(company.name?.value).toBe('Frio Sur');
    expect(company.phone?.value).toBe('+54 11 4571-2411');
    expect(company.address?.value).toBe('Av. Rivadavia 2300, CABA');
    expect(company.name?.provenance.strategy).toBe('json-ld');
    expect(company.name?.provenance.sourceUrl).toBe('https://friosur.com.ar');
  });

  it('extrae productos con precio en formato ingles', () => {
    const productHtml = `
      <script type="application/ld+json">
      {
        "@type": "Product",
        "name": "Cano de cobre 1/4 rollo x 15 m",
        "sku": "CU-14-15",
        "brand": "Madeco",
        "offers": { "@type": "Offer", "price": "125400.50", "priceCurrency": "ARS", "availability": "https://schema.org/InStock" }
      }
      </script>`;

    const page = buildPageContext('https://friosur.com.ar/p/1', productHtml, AT);
    const products = jsonLdProductStrategy.extract(page);

    expect(products).toHaveLength(1);
    expect(products[0]?.price?.value).toBe(125400.5);
    expect(products[0]?.sku?.value).toBe('CU-14-15');
    expect(products[0]?.availability?.value).toBe('InStock');
  });

  it('resuelve AggregateOffer anidado', () => {
    const aggregateHtml = `
      <script type="application/ld+json">
      { "@type": "Product", "name": "Split 3000f",
        "offers": { "@type": "AggregateOffer", "offers": [{ "price": "500000", "priceCurrency": "ARS" }] } }
      </script>`;

    const page = buildPageContext('https://a.com.ar/p', aggregateHtml, AT);
    expect(jsonLdProductStrategy.extract(page)[0]?.price?.value).toBe(500000);
  });
});

describe('estrategia microdata', () => {
  it('agrupa nombre y precio del mismo producto', () => {
    const html = `
      <div itemscope itemtype="http://schema.org/Product">
        <span itemprop="name">Gas R410A 11kg</span>
        <meta itemprop="price" content="180000.00">
        <meta itemprop="priceCurrency" content="ARS">
      </div>
      <div itemscope itemtype="http://schema.org/Product">
        <span itemprop="name">Bomba de vacio</span>
        <meta itemprop="price" content="95000.00">
      </div>`;

    const page = buildPageContext('https://a.com.ar/productos', html, AT);
    const products = microdataProductStrategy.extract(page);

    expect(products).toHaveLength(2);
    expect(products[0]?.name.value).toBe('Gas R410A 11kg');
    expect(products[0]?.price?.value).toBe(180000);
    expect(products[1]?.price?.value).toBe(95000);
  });
});

describe('registry', () => {
  it('gana la estrategia de mayor confianza', () => {
    const alta = { name: field('Correcto', { sourceUrl: 'u', strategy: 'json-ld', confidence: 0.95, observedAt: AT }) };
    const baja = { name: field('Incorrecto', { sourceUrl: 'u', strategy: 'heuristics', confidence: 0.4, observedAt: AT }) };

    expect(mergeCompanies([baja, alta]).name?.value).toBe('Correcto');
    expect(mergeCompanies([alta, baja]).name?.value).toBe('Correcto');
  });

  it('json-ld le gana a las meta tags en la misma pagina', () => {
    const html = `
      <meta property="og:site_name" content="Nombre de las meta tags">
      <script type="application/ld+json">{"@type":"Store","name":"Nombre de JSON-LD"}</script>`;

    const page = buildPageContext('https://a.com.ar', html, AT);
    const { company, strategiesUsed } = extractCompany(page);

    expect(company.name?.value).toBe('Nombre de JSON-LD');
    expect(strategiesUsed).toContain('json-ld');
    expect(strategiesUsed).toContain('meta-tags');
  });

  it('una estrategia que revienta no tumba a las demas', () => {
    const explosiva = {
      name: 'explosiva',
      confidence: 0.99,
      canHandle: () => true,
      extract: () => {
        throw new Error('boom');
      },
    };

    const page = buildPageContext('https://a.com.ar', '<title>Frio Sur</title>', AT);
    const result = extractCompany(page, [explosiva, metaTagsCompanyStrategy]);

    expect(result.errors[0]).toContain('boom');
    expect(result.company.name?.value).toBe('Frio Sur');
  });

  it('sin productos devuelve lista vacia sin error', () => {
    const page = buildPageContext('https://a.com.ar', '<html><body>nada</body></html>', AT);
    expect(extractProducts(page)).toEqual({ products: [], strategy: null, errors: [] });
  });
});
