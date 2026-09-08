/**
 * Dominio canonico: la clave de deduplicacion mas fuerte que tenemos.
 *
 * Dos URLs son la misma empresa si comparten dominio registrable. Por eso
 * `www.`, el subdominio `tienda.`, el protocolo, el puerto y el path se caen.
 */

/**
 * Sufijos de segundo nivel donde el dominio registrable tiene tres etiquetas.
 * Lista acotada a lo que aparece en el mercado argentino; agregar aca si hace
 * falta otro TLD. No usamos la Public Suffix List entera para no traer una
 * dependencia de 200 KB por una decena de casos reales.
 */
const MULTI_PART_SUFFIXES = new Set([
  'com.ar',
  'net.ar',
  'org.ar',
  'gob.ar',
  'gov.ar',
  'edu.ar',
  'int.ar',
  'mil.ar',
  'tur.ar',
  'com.br',
  'com.uy',
  'com.py',
  'com.bo',
  'com.mx',
  'co.uk',
  'com.es',
]);

const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
/** El TLD siempre es alfabetico. Descarta de paso las IPs. */
const TLD_PATTERN = /^[a-z]{2,}$/;

/**
 * Esquema seguido de algo que no es un puerto: `mailto:`, `tel:`, `javascript:`.
 * El negative lookahead deja pasar `ejemplo.com.ar:8080`, que si es una URL.
 */
const NON_HTTP_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;

/** Normaliza una URL suelta a algo que `new URL()` acepte. */
export const ensureProtocol = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  if (NON_HTTP_SCHEME.test(trimmed)) return '';
  return `https://${trimmed}`;
};

/** Hostname en minusculas, sin `www.` ni punto final. Null si no parsea. */
export const extractHostname = (raw: string): string | null => {
  const withProtocol = ensureProtocol(raw);
  if (!withProtocol) return null;

  let hostname: string;
  try {
    hostname = new URL(withProtocol).hostname;
  } catch {
    return null;
  }

  const cleaned = hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  return cleaned.length > 0 ? cleaned : null;
};

/**
 * Dominio registrable. `https://tienda.friosur.com.ar/productos` -> `friosur.com.ar`.
 * Devuelve null si la entrada no es un host valido (IPs incluidas: una IP no
 * identifica una empresa).
 */
export const canonicalDomain = (raw: string): string | null => {
  const hostname = extractHostname(raw);
  if (!hostname) return null;
  if (!HOSTNAME_PATTERN.test(hostname)) return null;

  const labels = hostname.split('.');
  if (labels.length < 2) return null;

  // Sin TLD alfabetico no es un dominio: descarta IPs y hosts internos.
  if (!TLD_PATTERN.test(labels[labels.length - 1] ?? '')) return null;

  const lastTwo = labels.slice(-2).join('.');
  const take = MULTI_PART_SUFFIXES.has(lastTwo) ? 3 : 2;
  if (labels.length < take) return null;

  return labels.slice(-take).join('.');
};

/** URL absoluta, sin fragmento ni parametros de tracking, para guardar como fuente. */
export const canonicalUrl = (raw: string, base?: string): string | null => {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(ensureProtocol(raw));
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_|_ga)/i.test(key)) url.searchParams.delete(key);
  }
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }

  return url.toString();
};

/** true si ambas URLs viven en el mismo dominio registrable. */
export const isSameSite = (a: string, b: string): boolean => {
  const domainA = canonicalDomain(a);
  const domainB = canonicalDomain(b);
  return domainA !== null && domainA === domainB;
};
