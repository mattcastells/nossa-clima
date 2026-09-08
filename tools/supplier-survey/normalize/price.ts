/**
 * Precios.
 *
 * El punto delicado: en Argentina el separador de miles es el punto y el
 * decimal es la coma (`$ 125.400,50`), pero muchos sitios emiten JSON-LD con
 * formato ingles (`125400.50`). Leer mal un separador cambia el precio por mil,
 * y ese numero termina en el informe que ve un cliente. Ante la duda, null.
 */

export interface ParsedPrice {
  amount: number;
  currency: string;
}

const CURRENCY_HINTS: Array<{ pattern: RegExp; currency: string }> = [
  { pattern: /\bUSD\b|\bU\$S|\bdolar/i, currency: 'USD' },
  { pattern: /\bARS\b|\$/, currency: 'ARS' },
  { pattern: /\bEUR\b|€/, currency: 'EUR' },
];

/** Moneda declarada en el texto. Default ARS: el mercado del proyecto. */
export const detectCurrency = (raw: string | null | undefined): string => {
  if (typeof raw !== 'string') return 'ARS';
  for (const hint of CURRENCY_HINTS) {
    if (hint.pattern.test(raw)) return hint.currency;
  }
  return 'ARS';
};

/**
 * Convierte el texto de un precio en numero.
 *
 * `locale: 'es'` fuerza la lectura argentina (punto = miles, coma = decimal).
 * `locale: 'en'` fuerza la inglesa. `'auto'` decide por la forma del numero,
 * que es lo correcto para JSON-LD (`price` viene siempre en formato ingles,
 * pero no todos los sitios lo respetan).
 */
export const parsePrice = (raw: string | number | null | undefined, locale: 'es' | 'en' | 'auto' = 'auto'): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? round2(raw) : null;
  if (typeof raw !== 'string') return null;

  const text = raw.trim();
  if (text.length === 0) return null;

  // Nos quedamos con el primer numero del texto: "Desde $ 125.400 (IVA incl.)".
  const match = text.match(/-?\d[\d.,\s]*\d|\d/);
  if (!match) return null;

  const numeric = match[0].replace(/\s/g, '');
  const lastComma = numeric.lastIndexOf(',');
  const lastDot = numeric.lastIndexOf('.');

  let normalized: string;

  if (lastComma === -1 && lastDot === -1) {
    normalized = numeric;
  } else if (lastComma !== -1 && lastDot !== -1) {
    // Estan los dos: el ultimo en aparecer es el decimal.
    normalized = lastComma > lastDot ? stripThousands(numeric, '.').replace(',', '.') : stripThousands(numeric, ',');
  } else {
    const separator = lastComma !== -1 ? ',' : '.';
    const decimals = numeric.length - numeric.lastIndexOf(separator) - 1;
    const isDecimal = decideSingleSeparator(separator, decimals, locale);
    normalized = isDecimal ? numeric.replace(separator, '.') : stripThousands(numeric, separator);
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;

  return round2(value);
};

/**
 * Con un solo separador hay ambiguedad real: `1.234` son mil doscientos treinta
 * y cuatro pesos o un peso veintitres.
 *
 * Si el locale es explicito, decide el locale y no se discute. Antes la forma
 * mandaba siempre, y `9074.33266666667` leido como 'en' —once decimales, que es
 * lo que emite una formula de planilla— terminaba en 907.433.266.666.667.
 * Solo 'auto' mira la forma:
 *   - exactamente 3 decimales -> separador de miles (nadie cotiza en milesimos);
 *   - 1 o 2 decimales -> decimal;
 *   - cualquier otra cantidad -> miles.
 */
const decideSingleSeparator = (separator: ',' | '.', decimals: number, locale: 'es' | 'en' | 'auto'): boolean => {
  if (locale === 'es') return separator === ',';
  if (locale === 'en') return separator === '.';

  if (decimals === 3) return false;
  return decimals === 1 || decimals === 2;
};

/**
 * Valor numerico de una celda de planilla.
 *
 * Un xlsx guarda los numeros en formato de maquina (punto decimal, sin
 * separador de miles), incluido el valor cacheado de las formulas. No hay nada
 * que interpretar, y pasarlo por `parsePrice` es exponerse a que la heuristica
 * de separadores lo arruine.
 */
export const parseSpreadsheetNumber = (raw: string | null | undefined): number | null => {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : null;
};

const stripThousands = (numeric: string, separator: ',' | '.'): string =>
  numeric.split(separator).join('');

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Precio + moneda a partir de un texto suelto. */
export const parsePriceWithCurrency = (raw: string | null | undefined): ParsedPrice | null => {
  const amount = parsePrice(raw, 'es');
  if (amount === null) return null;
  return { amount, currency: detectCurrency(raw) };
};

/**
 * Presentacion del producto: `Rollo x 15 m`, `Bidon 5 L`, `Caja x 100 u`.
 * Nos interesa para poder comparar precios entre tiendas que venden el mismo
 * material en envases distintos.
 */
export interface Presentation {
  quantity: number;
  unit: string;
}

const UNIT_ALIASES: Record<string, string> = {
  m: 'm',
  mt: 'm',
  mts: 'm',
  metro: 'm',
  metros: 'm',
  cm: 'cm',
  mm: 'mm',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  g: 'g',
  gr: 'g',
  gramo: 'g',
  gramos: 'g',
  l: 'L',
  lt: 'L',
  lts: 'L',
  litro: 'L',
  litros: 'L',
  ml: 'ml',
  u: 'u',
  un: 'u',
  uni: 'u',
  unidad: 'u',
  unidades: 'u',
};

export const parsePresentation = (raw: string | null | undefined): Presentation | null => {
  if (typeof raw !== 'string') return null;

  const match = raw.match(/(\d+(?:[.,]\d+)?)\s*(m|mt|mts|metros?|cm|mm|kg|kilos?|gr?|gramos?|lts?|litros?|l|ml|u|un|uni|unidades?)\b/i);
  if (!match) return null;

  const quantity = Number.parseFloat((match[1] ?? '').replace(',', '.'));
  const unitRaw = (match[2] ?? '').toLowerCase();
  const unit = UNIT_ALIASES[unitRaw];

  if (!Number.isFinite(quantity) || quantity <= 0 || !unit) return null;

  return { quantity, unit };
};
