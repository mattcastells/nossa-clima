/**
 * robots.txt.
 *
 * No es opcional: relevar un sitio que pidio que no lo relevemos es la forma
 * mas rapida de que nos bloqueen y de tener un problema que no es tecnico.
 * Ante la duda (robots.txt ilegible, error 500 al pedirlo) permitimos, que es
 * el comportamiento estandar; ante un 401/403 al robots.txt, no.
 */

export interface RobotsRules {
  /** Reglas que aplican a nuestro user-agent, ya resueltas. */
  disallow: string[];
  allow: string[];
  crawlDelaySeconds: number | null;
  sitemaps: string[];
}

export const emptyRules = (): RobotsRules => ({ disallow: [], allow: [], crawlDelaySeconds: null, sitemaps: [] });

/**
 * Parsea un robots.txt quedandose con el grupo mas especifico que nos aplique:
 * un bloque para nuestro user-agent si existe, y si no el de `*`.
 */
export const parseRobots = (content: string, userAgent: string): RobotsRules => {
  const agentKey = userAgent.toLowerCase();

  const groups = new Map<string, RobotsRules>();
  const sitemaps: string[] = [];
  let currentAgents: string[] = [];
  let previousWasAgent = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (line.length === 0) continue;

    const separator = line.indexOf(':');
    if (separator === -1) continue;

    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (directive === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }

    if (directive === 'user-agent') {
      // User-agents consecutivos comparten el mismo grupo de reglas.
      if (!previousWasAgent) currentAgents = [];
      currentAgents.push(value.toLowerCase());
      previousWasAgent = true;
      continue;
    }

    previousWasAgent = false;
    if (currentAgents.length === 0) continue;

    for (const agent of currentAgents) {
      const group = groups.get(agent) ?? emptyRules();

      if (directive === 'disallow' && value.length > 0) group.disallow.push(value);
      else if (directive === 'allow' && value.length > 0) group.allow.push(value);
      else if (directive === 'crawl-delay') {
        const delay = Number.parseFloat(value);
        if (Number.isFinite(delay)) group.crawlDelaySeconds = delay;
      }

      groups.set(agent, group);
    }
  }

  // Coincidencia exacta, o el prefijo del token del UA (ej. "nossaclimabot").
  const exact = groups.get(agentKey);
  const partial = [...groups.entries()].find(([agent]) => agent.length > 1 && agentKey.includes(agent));
  const rules = exact ?? partial?.[1] ?? groups.get('*') ?? emptyRules();

  return { ...rules, sitemaps };
};

/** Convierte un patron de robots.txt (con `*` y `$`) en regex. */
const patternToRegex = (pattern: string): RegExp => {
  // `$` al final ancla el patron; en el medio es un caracter mas.
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');

  return new RegExp(`^${escaped}${anchored ? '$' : ''}`);
};

/**
 * ¿Podemos pedir esta ruta?
 * La regla mas larga gana, y ante empate gana `Allow`, que es lo que dice la
 * especificacion de Google y lo que hacen los crawlers serios.
 */
export const isPathAllowed = (rules: RobotsRules, path: string): boolean => {
  let bestAllow = -1;
  let bestDisallow = -1;

  for (const pattern of rules.allow) {
    if (patternToRegex(pattern).test(path)) bestAllow = Math.max(bestAllow, pattern.length);
  }

  for (const pattern of rules.disallow) {
    if (patternToRegex(pattern).test(path)) bestDisallow = Math.max(bestDisallow, pattern.length);
  }

  if (bestDisallow === -1) return true;
  return bestAllow >= bestDisallow;
};

export interface RobotsFetcher {
  (robotsUrl: string): Promise<{ status: number; body: string } | null>;
}

/**
 * Cache de robots.txt por origen. Un origen se consulta una sola vez por
 * corrida, aunque relevemos veinte paginas suyas.
 */
export class RobotsCache {
  private readonly cache = new Map<string, RobotsRules | 'blocked'>();

  private readonly userAgent: string;
  private readonly fetcher: RobotsFetcher;

  constructor(userAgent: string, fetcher: RobotsFetcher) {
    this.userAgent = userAgent;
    this.fetcher = fetcher;
  }

  async rulesFor(url: string): Promise<RobotsRules | 'blocked'> {
    let origin: string;
    try {
      origin = new URL(url).origin;
    } catch {
      return emptyRules();
    }

    const cached = this.cache.get(origin);
    if (cached !== undefined) return cached;

    const result = await this.resolve(origin);
    this.cache.set(origin, result);
    return result;
  }

  private async resolve(origin: string): Promise<RobotsRules | 'blocked'> {
    let response: { status: number; body: string } | null = null;

    try {
      response = await this.fetcher(`${origin}/robots.txt`);
    } catch {
      // Sin robots.txt accesible, el estandar dice que se permite.
      return emptyRules();
    }

    if (!response) return emptyRules();
    // 401/403 en robots.txt significa que el sitio no nos quiere. Se respeta.
    if (response.status === 401 || response.status === 403) return 'blocked';
    if (response.status >= 400) return emptyRules();

    return parseRobots(response.body, this.userAgent);
  }

  async isAllowed(url: string): Promise<{ allowed: boolean; crawlDelaySeconds: number | null }> {
    const rules = await this.rulesFor(url);
    if (rules === 'blocked') return { allowed: false, crawlDelaySeconds: null };

    let path: string;
    try {
      const parsed = new URL(url);
      path = `${parsed.pathname}${parsed.search}`;
    } catch {
      return { allowed: false, crawlDelaySeconds: null };
    }

    return { allowed: isPathAllowed(rules, path), crawlDelaySeconds: rules.crawlDelaySeconds };
  }
}
