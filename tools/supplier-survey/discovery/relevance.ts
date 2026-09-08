/**
 * ¿Este sitio es un proveedor de insumos de aire acondicionado?
 *
 * El discovery trae ruido: instaladores particulares, blogs, marketplaces
 * genericos, fabricantes de otro rubro. Filtrar bien aca es lo que evita que la
 * cola de revision se vuelva impracticable.
 *
 * El puntaje es 0..100 y se compone de senales positivas (rubro, producto,
 * comercial) menos senales negativas. No es un clasificador: es un filtro
 * conservador cuyo unico trabajo es decidir si vale la pena que una persona lo
 * mire.
 */

import { foldAccents } from '../normalize/text.ts';

interface SignalGroup {
  readonly label: string;
  readonly terms: readonly string[];
  /** Puntos por el grupo entero, no por termino: repetir "split" 40 veces no suma. */
  readonly weight: number;
  /**
   * Descarta el sitio sin importar el puntaje. Un marketplace habla del rubro
   * mejor que cualquier proveedor real y siempre ganaria por puntos.
   */
  readonly hard?: boolean;
}

/** Rubro. Sin al menos una de estas, el sitio no es de lo nuestro. */
const DOMAIN_SIGNALS: readonly SignalGroup[] = [
  {
    label: 'hvac',
    weight: 30,
    terms: [
      'aire acondicionado',
      'acondicionado',
      'climatizacion',
      'refrigeracion',
      'hvac',
      'split',
      'multisplit',
      'aire central',
      'frio calor',
      'calefaccion',
      'ventilacion',
    ],
  },
];

/** Producto e insumo concreto. Es lo que separa un proveedor de un blog. */
const PRODUCT_SIGNALS: readonly SignalGroup[] = [
  {
    label: 'insumos',
    weight: 25,
    terms: [
      'caneria de cobre',
      'cano de cobre',
      'tubo de cobre',
      'aislacion',
      'gas refrigerante',
      'r410',
      'r410a',
      'r32',
      'r22',
      'r134',
      'soporte de pared',
      'bomba de condensado',
      'compresor',
      'condensador',
      'evaporador',
      'termostato',
      'presostato',
      'capacitor',
      'placa electronica',
      'manometro',
      'vacuometro',
      'bomba de vacio',
      'recuperadora',
      'abocardador',
      'sopletes',
      'valvula',
      'filtro secador',
      'bandeja de desagote',
      'conducto',
      'rejilla',
      'ducto',
    ],
  },
];

/** Que es un comercio y no una pagina institucional o un particular. */
const COMMERCE_SIGNALS: readonly SignalGroup[] = [
  {
    label: 'comercio',
    weight: 20,
    terms: [
      'mayorista',
      'distribuidor',
      'distribuidora',
      'proveedor',
      'venta de insumos',
      'lista de precios',
      'catalogo',
      'tienda',
      'carrito',
      'comprar',
      'stock',
      'sucursal',
      'repuestos',
      'accesorios',
      'ferreteria',
      'materiales electricos',
      'insumos',
    ],
  },
];

/** Restan. Un marketplace o un blog puede tener todas las palabras del rubro. */
const NEGATIVE_SIGNALS: readonly SignalGroup[] = [
  {
    label: 'marketplace',
    weight: 35,
    hard: true,
    terms: ['mercadolibre', 'mercado libre', 'olx', 'alibaba', 'aliexpress', 'amazon.com', 'ebay', 'tiendamia'],
  },
  {
    label: 'no-comercial',
    weight: 25,
    terms: [
      'blog de',
      'wikipedia',
      'foro de',
      'curso de',
      'capacitacion',
      'universidad',
      'municipalidad',
      'gobierno de',
      'ministerio de',
      'noticias',
      'clasificados',
    ],
  },
  {
    label: 'otro-rubro',
    weight: 20,
    terms: ['inmobiliaria', 'automotor', 'concesionaria', 'farmacia', 'veterinaria', 'indumentaria', 'turismo'],
  },
];

export interface RelevanceResult {
  score: number;
  /** Grupos que dispararon, para poder explicar la decision en el reporte. */
  matched: string[];
  rejected: string[];
  /** false = ni siquiera es del rubro. Se descarta sin pasar por revision. */
  isRelevant: boolean;
}

/** Debajo de esto un candidato se marca `irrelevant` y no llega a la cola. */
export const RELEVANCE_THRESHOLD = 35;

const groupMatches = (haystack: string, group: SignalGroup): boolean =>
  group.terms.some((term) => haystack.includes(term));

/**
 * `text` puede ser el contenido visible de la home, el titulo, la descripcion,
 * o los tres concatenados. Cuanto mas contexto, mejor la decision.
 */
export const scoreRelevance = (text: string): RelevanceResult => {
  const haystack = foldAccents(text);
  const matched: string[] = [];
  const rejected: string[] = [];

  let score = 0;
  let hasDomainSignal = false;
  let hardRejected = false;

  for (const group of DOMAIN_SIGNALS) {
    if (!groupMatches(haystack, group)) continue;
    score += group.weight;
    matched.push(group.label);
    hasDomainSignal = true;
  }

  for (const group of [...PRODUCT_SIGNALS, ...COMMERCE_SIGNALS]) {
    if (!groupMatches(haystack, group)) continue;
    score += group.weight;
    matched.push(group.label);
  }

  for (const group of NEGATIVE_SIGNALS) {
    if (!groupMatches(haystack, group)) continue;
    score -= group.weight;
    rejected.push(group.label);
    if (group.hard === true) hardRejected = true;
  }

  const bounded = Math.max(0, Math.min(100, score));

  return {
    score: bounded,
    matched,
    rejected,
    // Sin senal de rubro no hay caso, por mas comercio que sea.
    isRelevant: !hardRejected && hasDomainSignal && bounded >= RELEVANCE_THRESHOLD,
  };
};
