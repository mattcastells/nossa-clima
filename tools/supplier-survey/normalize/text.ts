/** Limpieza de texto y normalizacion de nombres de empresa. */

/** Colapsa espacios, saca entidades HTML sueltas y recorta. */
export const cleanText = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null;

  const decoded = raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));

  // \s en JS ya cubre el espacio duro (U+00A0) y el resto de los separadores.
  const collapsed = decoded.replace(/\s+/gu, ' ').trim();
  return collapsed.length > 0 ? collapsed : null;
};

/** Igual que cleanText pero conserva los saltos de linea (para direcciones). */
export const cleanMultiline = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null;

  const lines = raw
    .split(/\r?\n/)
    .map((line) => cleanText(line))
    .filter((line): line is string => line !== null);

  const joined = lines.join('\n').trim();
  return joined.length > 0 ? joined : null;
};

/** Sin tildes, minusculas. Para comparar, nunca para mostrar. */
export const foldAccents = (raw: string): string =>
  raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

const LEGAL_SUFFIXES = [
  's\\.?a\\.?s\\.?',
  's\\.?r\\.?l\\.?',
  's\\.?a\\.?c\\.?i\\.?',
  's\\.?a\\.?',
  'sociedad anonima',
  'sociedad de responsabilidad limitada',
  'e\\.?i\\.?r\\.?l\\.?',
  'ltda\\.?',
  'inc\\.?',
  'llc',
];

const NOISE_WORDS = new Set([
  'inicio',
  'home',
  'bienvenidos',
  'bienvenido',
  'tienda',
  'shop',
  'online',
  'oficial',
  'web',
  'sitio',
  'productos',
  'catalogo',
]);

/**
 * Clave de comparacion de un nombre de empresa: sin tildes, sin forma
 * societaria, sin palabras de relleno de titulo (`Inicio | Frio Sur`).
 * `"FRIO SUR S.R.L."` y `"Frio Sur"` colapsan al mismo valor.
 */
export const companyNameKey = (raw: string | null | undefined): string => {
  const cleaned = cleanText(raw);
  if (!cleaned) return '';

  let key = foldAccents(cleaned);
  for (const suffix of LEGAL_SUFFIXES) {
    key = key.replace(new RegExp(`(^|[\\s,.-])${suffix}($|[\\s,.-])`, 'g'), ' ');
  }

  const words = key
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !NOISE_WORDS.has(word));

  return words.join(' ').trim();
};

/**
 * Nombre presentable a partir del `<title>` de una home.
 * Los titulos vienen como `Frio Sur | Insumos de refrigeracion` o
 * `Inicio - Frio Sur`: nos quedamos con el segmento que parece la marca.
 */
export const companyNameFromTitle = (title: string | null | undefined): string | null => {
  const cleaned = cleanText(title);
  if (!cleaned) return null;

  const segments = cleaned
    // Separadores de titulo: pipe, guion, guion medio, guion largo, comillas angulares.
    .split(/\s+[|–—»-]\s+/u)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) return null;

  const meaningful = segments.filter((segment) => companyNameKey(segment).length >= 3);
  const chosen = meaningful[0] ?? segments[0];
  if (!chosen) return null;

  // Un titulo entero de 80 caracteres no es un nombre de empresa, es un slogan.
  return chosen.length <= 80 ? chosen : truncate(chosen, 80);
};

/** Recorta a `max` sin cortar una palabra al medio. */
export const truncate = (raw: string, max: number): string => {
  if (raw.length <= max) return raw;
  const slice = raw.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trim();
};
