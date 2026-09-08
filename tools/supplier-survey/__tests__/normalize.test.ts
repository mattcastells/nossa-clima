import { describe, expect, it } from 'vitest';

import { canonicalDomain, canonicalUrl, isSameSite } from '../normalize/domain.ts';
import { findPhones, formatPhone, phoneKey, phoneKeys } from '../normalize/phone.ts';
import { detectCurrency, parsePresentation, parsePrice, parseSpreadsheetNumber } from '../normalize/price.ts';
import { cleanText, companyNameFromTitle, companyNameKey, truncate } from '../normalize/text.ts';

describe('canonicalDomain', () => {
  it('saca protocolo, www, subdominio y path', () => {
    expect(canonicalDomain('https://www.friosur.com.ar/productos?x=1')).toBe('friosur.com.ar');
    expect(canonicalDomain('http://tienda.friosur.com.ar')).toBe('friosur.com.ar');
    expect(canonicalDomain('friosur.com.ar')).toBe('friosur.com.ar');
  });

  it('respeta los sufijos de segundo nivel argentinos', () => {
    expect(canonicalDomain('https://algo.com.ar')).toBe('algo.com.ar');
    expect(canonicalDomain('https://sub.algo.com.ar')).toBe('algo.com.ar');
    expect(canonicalDomain('https://algo.com')).toBe('algo.com');
    expect(canonicalDomain('https://sub.algo.com')).toBe('algo.com');
  });

  it('rechaza lo que no identifica una empresa', () => {
    expect(canonicalDomain('https://192.168.0.1/x')).toBeNull();
    expect(canonicalDomain('no es una url')).toBeNull();
    expect(canonicalDomain('')).toBeNull();
    expect(canonicalDomain('localhost')).toBeNull();
  });
});

describe('canonicalUrl', () => {
  it('saca fragmento y parametros de tracking', () => {
    expect(canonicalUrl('https://a.com.ar/x?utm_source=google&id=3#top')).toBe('https://a.com.ar/x?id=3');
  });

  it('resuelve relativas contra la base', () => {
    expect(canonicalUrl('/contacto', 'https://a.com.ar/productos')).toBe('https://a.com.ar/contacto');
  });

  it('rechaza esquemas que no son http', () => {
    expect(canonicalUrl('mailto:a@b.com')).toBeNull();
    expect(canonicalUrl('javascript:void(0)')).toBeNull();
  });
});

describe('isSameSite', () => {
  it('compara por dominio registrable', () => {
    expect(isSameSite('https://www.a.com.ar/x', 'https://tienda.a.com.ar/y')).toBe(true);
    expect(isSameSite('https://a.com.ar', 'https://b.com.ar')).toBe(false);
  });
});

describe('phoneKey', () => {
  it('colapsa los formatos del mismo numero', () => {
    const expected = '1145712411';
    expect(phoneKey('11 4571-2411')).toBe(expected);
    expect(phoneKey('+54 11 4571 2411')).toBe(expected);
    expect(phoneKey('(011) 4571-2411')).toBe(expected);
    expect(phoneKey('0054 11 4571 2411')).toBe(expected);
    expect(phoneKey('+54 9 11 4571 2411')).toBe(expected);
    expect(phoneKey('011 15 4571 2411')).toBe(expected);
  });

  it('descarta lo que no puede ser un telefono', () => {
    expect(phoneKey('123')).toBeNull();
    expect(phoneKey('sin telefono')).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
});

describe('phoneKeys', () => {
  it('separa varios numeros en un mismo campo', () => {
    // Este formato existe tal cual en la base: "1147023044/1169308918".
    expect(phoneKeys('1147023044/1169308918')).toEqual(['1147023044', '1169308918']);
  });

  it('devuelve uno solo cuando hay uno solo', () => {
    expect(phoneKeys('11 4571-2411')).toEqual(['1145712411']);
  });
});

describe('formatPhone', () => {
  it('formatea numeros de CABA con area de dos digitos', () => {
    expect(formatPhone('+541145712411')).toBe('11 4571-2411');
  });

  it('devuelve el texto limpio si no reconoce el patron', () => {
    expect(formatPhone('  interno  42 ')).toBe('interno 42');
  });
});

describe('findPhones', () => {
  it('encuentra telefonos en enlaces tel: y en el texto', () => {
    const html = '<a href="tel:+541145712411">Llamanos</a> o al 11 4571-2412';
    expect(findPhones(html)).toEqual(expect.arrayContaining(['1145712411', '1145712412']));
  });
});

describe('parsePrice', () => {
  it('lee formato argentino', () => {
    expect(parsePrice('$ 125.400,50', 'es')).toBe(125400.5);
    expect(parsePrice('125.400', 'es')).toBe(125400);
  });

  it('lee formato ingles, que es el que usa JSON-LD', () => {
    expect(parsePrice('125400.50', 'en')).toBe(125400.5);
    expect(parsePrice(125400.5)).toBe(125400.5);
  });

  it('trata tres decimales como separador de miles', () => {
    // Nadie cotiza en milesimos de peso.
    expect(parsePrice('1.234')).toBe(1234);
    expect(parsePrice('1,234')).toBe(1234);
  });

  it('descarta valores que no son precios', () => {
    expect(parsePrice('consultar')).toBeNull();
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice('-100')).toBeNull();
  });

  it('toma el primer numero de un texto con ruido', () => {
    expect(parsePrice('Desde $ 12.500 (IVA incluido)', 'es')).toBe(12500);
  });

  it('con locale explicito manda el locale, no la cantidad de decimales', () => {
    // Una formula de planilla emite toda la precision del float. Leer esto
    // como separador de miles daba 907.433.266.666.667 y reventaba el insert.
    expect(parsePrice('9074.33266666667', 'en')).toBe(9074.33);
    expect(parsePrice('11884.4813333333', 'en')).toBe(11884.48);
    expect(parsePrice('155,122', 'es')).toBe(155.12);
  });
});

describe('parseSpreadsheetNumber', () => {
  it('lee el numero de maquina de una celda tal cual', () => {
    expect(parseSpreadsheetNumber('9074.33266666667')).toBeCloseTo(9074.33266666667, 8);
    expect(parseSpreadsheetNumber('83421')).toBe(83421);
    expect(parseSpreadsheetNumber('15')).toBe(15);
  });

  it('devuelve null con celdas vacias o no numericas', () => {
    expect(parseSpreadsheetNumber('')).toBeNull();
    expect(parseSpreadsheetNumber('   ')).toBeNull();
    expect(parseSpreadsheetNumber('consultar')).toBeNull();
    expect(parseSpreadsheetNumber(null)).toBeNull();
  });
});

describe('detectCurrency', () => {
  it('reconoce dolares y cae a pesos por defecto', () => {
    expect(detectCurrency('U$S 120')).toBe('USD');
    expect(detectCurrency('$ 120')).toBe('ARS');
    expect(detectCurrency('120')).toBe('ARS');
  });
});

describe('parsePresentation', () => {
  it('lee cantidad y unidad del nombre del producto', () => {
    expect(parsePresentation('Cano de cobre 1/4 rollo x 15 m')).toEqual({ quantity: 15, unit: 'm' });
    expect(parsePresentation('Bidon 5 litros')).toEqual({ quantity: 5, unit: 'L' });
    expect(parsePresentation('Caja x 100 unidades')).toEqual({ quantity: 100, unit: 'u' });
  });

  it('devuelve null si no hay presentacion', () => {
    expect(parsePresentation('Compresor rotativo')).toBeNull();
  });
});

describe('cleanText', () => {
  it('decodifica entidades y colapsa espacios', () => {
    expect(cleanText('  Fr&iacute;o   &amp;  Calor  ')).toBe('Fr&iacute;o & Calor');
    expect(cleanText('a&#160;b')).toBe('a b');
    expect(cleanText('   ')).toBeNull();
    expect(cleanText(undefined)).toBeNull();
  });
});

describe('companyNameKey', () => {
  it('colapsa tildes, forma societaria y mayusculas', () => {
    expect(companyNameKey('FRÍO SUR S.R.L.')).toBe(companyNameKey('Frio Sur'));
    expect(companyNameKey('Clima Norte S.A.')).toBe('clima norte');
  });

  it('saca palabras de relleno', () => {
    expect(companyNameKey('Inicio')).toBe('');
    expect(companyNameKey('Tienda Online Pizarro')).toBe('pizarro');
  });
});

describe('companyNameFromTitle', () => {
  it('se queda con el segmento que parece la marca', () => {
    expect(companyNameFromTitle('Frio Sur | Insumos de refrigeracion')).toBe('Frio Sur');
    expect(companyNameFromTitle('Inicio - Pizarro Refrigeracion')).toBe('Pizarro Refrigeracion');
  });

  it('devuelve null con titulo vacio', () => {
    expect(companyNameFromTitle('')).toBeNull();
    expect(companyNameFromTitle(null)).toBeNull();
  });
});

describe('truncate', () => {
  it('no corta palabras al medio', () => {
    expect(truncate('distribuidora de insumos', 15)).toBe('distribuidora');
    expect(truncate('corto', 20)).toBe('corto');
  });
});
