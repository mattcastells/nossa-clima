/**
 * Primitivas de HTML.
 *
 * Todo el pipeline lee HTML *solo* por aca. Es a proposito: si algun dia hace
 * falta un parser real (cheerio, linkedom), se reemplaza este archivo y el
 * resto no se entera. Hoy no hace falta, porque la informacion que buscamos
 * vive en lugares estructurados (JSON-LD, meta tags, enlaces tel:/mailto:) y
 * no en la posicion de un div, que es justamente lo que se rompe cuando un
 * sitio se redisena.
 */

const SCRIPT_STYLE = /<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi;
const TAG = /<[^>]+>/g;
const COMMENT = /<!--[\s\S]*?-->/g;

/** Texto visible: sin scripts, sin estilos, sin tags, con espacios colapsados. */
export const visibleText = (html: string): string =>
  html
    .replace(COMMENT, ' ')
    .replace(SCRIPT_STYLE, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(TAG, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[^\S\n]+/g, ' ')
    // Sin esto cada salto de linea arrastra el espacio que dejo el tag.
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Contenido de `<title>`. */
export const extractTitle = (html: string): string | null => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, ' ').trim() || null;
};

const ATTR = (name: string): RegExp => new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');

const readAttr = (tag: string, name: string): string | null => {
  const match = tag.match(ATTR(name));
  if (!match) return null;
  return match[2] ?? match[3] ?? match[4] ?? null;
};

/**
 * Meta tags indexadas por su `name` o `property`, en minusculas.
 * `og:site_name`, `description`, `product:price:amount`, etc.
 */
export const extractMetaTags = (html: string): Record<string, string> => {
  const tags: Record<string, string> = {};

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const key = readAttr(tag, 'property') ?? readAttr(tag, 'name') ?? readAttr(tag, 'itemprop');
    const content = readAttr(tag, 'content');
    if (!key || content === null) continue;

    const normalizedKey = key.toLowerCase().trim();
    // Primera aparicion gana: las de abajo suelen ser de widgets de terceros.
    if (!(normalizedKey in tags)) tags[normalizedKey] = content.trim();
  }

  return tags;
};

/**
 * Bloques `<script type="application/ld+json">` ya parseados.
 * Los que no son JSON valido se descartan en silencio: es comunisimo que un
 * sitio emita JSON-LD roto, y no es motivo para fallar el relevamiento.
 */
export const extractJsonLd = (html: string): unknown[] => {
  const blocks: unknown[] = [];

  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = match[1];
    if (!body) continue;

    try {
      // Algunos CMS envuelven el JSON en comentarios CDATA.
      const cleaned = body.replace(/^\s*\/\/\s*<!\[CDATA\[/, '').replace(/\/\/\s*\]\]>\s*$/, '').trim();
      if (cleaned.length === 0) continue;
      blocks.push(JSON.parse(cleaned));
    } catch {
      continue;
    }
  }

  return blocks;
};

/**
 * Aplana un grafo JSON-LD: `@graph`, arrays anidados y objetos sueltos quedan
 * como una lista plana de nodos con `@type`.
 */
export const flattenJsonLd = (blocks: readonly unknown[]): Array<Record<string, unknown>> => {
  const nodes: Array<Record<string, unknown>> = [];

  const walk = (node: unknown, depth: number): void => {
    if (depth > 6 || node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const child of node) walk(child, depth + 1);
      return;
    }

    const record = node as Record<string, unknown>;
    if ('@type' in record) nodes.push(record);

    for (const key of ['@graph', 'itemListElement', 'mainEntity', 'hasPart']) {
      if (key in record) walk(record[key], depth + 1);
    }
  };

  for (const block of blocks) walk(block, 0);
  return nodes;
};

/** true si el nodo declara alguno de los tipos pedidos (`@type` puede ser array). */
export const hasJsonLdType = (node: Record<string, unknown>, types: readonly string[]): boolean => {
  const raw = node['@type'];
  const declared = Array.isArray(raw) ? raw : [raw];
  const wanted = new Set(types.map((type) => type.toLowerCase()));

  return declared.some((entry) => typeof entry === 'string' && wanted.has(entry.toLowerCase()));
};

export interface HtmlLink {
  href: string;
  text: string;
}

/** Todos los `<a href>` con su texto visible. */
export const extractLinks = (html: string): HtmlLink[] => {
  const links: HtmlLink[] = [];

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = readAttr(match[1] ?? '', 'href');
    if (!href) continue;
    links.push({ href: href.trim(), text: visibleText(match[2] ?? '') });
  }

  return links;
};

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/**
 * Emails del documento. Filtra los de ejemplo y los de assets
 * (`sentry@`, `noreply@`, `@2x.png` mal matcheado, etc.).
 */
export const findEmails = (html: string): string[] => {
  const found = new Set<string>();

  for (const match of html.matchAll(EMAIL)) {
    const email = match[0].toLowerCase();
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email)) continue;
    if (/^(noreply|no-reply|sentry|wordpress|example|test|user)@/.test(email)) continue;
    if (/(example|sentry|wixpress|godaddy|schema\.org)\./.test(email)) continue;
    found.add(email);
  }

  return [...found];
};

/** Contenido de una etiqueta concreta, ej. `<h1>`. Devuelve todas las apariciones. */
export const extractTagContents = (html: string, tagName: string): string[] => {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
  const contents: string[] = [];

  for (const match of html.matchAll(pattern)) {
    const text = visibleText(match[1] ?? '');
    if (text.length > 0) contents.push(text);
  }

  return contents;
};
