/**
 * Identidad de un material.
 *
 * No se puede reusar `companyNameKey` para esto, y el motivo es concreto: esa
 * funcion descarta los tokens de un caracter, asi que 'Manguera cristal 1/4"' y
 * "Manguera cristal 5/8 (mt)" colapsan las dos a "manguera cristal" y dan 0,94
 * de similitud. En un material la medida NO es ruido: es lo que lo identifica.
 * Adjudicar el precio de la manguera de 1/4 a la de 5/8 termina en el informe
 * que ve un cliente.
 *
 * Entonces el nombre se parte en dos:
 *   - medidas  ('1/4', '3x1,5', '42')  -> tienen que coincidir
 *   - palabras ('manguera cristal')    -> se comparan por similitud
 */

import { foldAccents } from './text.ts';

/** Unidades y conectores: no distinguen un material de otro. */
const NOISE_WORDS = new Set([
  'mm',
  'cm',
  'mt',
  'mts',
  'm',
  'metro',
  'metros',
  'kg',
  'gr',
  'lt',
  'litro',
  'un',
  'unidad',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'por',
  'con',
  'sin',
  'para',
  'tipo',
  'x',
  'y',
]);

/**
 * Medidas del nombre, normalizadas.
 * Reconoce productos ("3x1,5"), fracciones ("1/4") y numeros sueltos ("42").
 * Descarta el sufijo de unidad: "42 cm" y "42" son la misma medida.
 */
export const materialMeasures = (name: string): string[] => {
  const folded = foldAccents(name);
  const measures: string[] = [];

  const pattern = /(\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?)|(\d+\s*\/\s*\d+)|(\d+(?:[.,]\d+)?)/g;

  for (const match of folded.matchAll(pattern)) {
    const raw = match[0].replace(/\s+/g, '').replace(/,/g, '.');
    if (raw.length > 0) measures.push(raw);
  }

  return [...new Set(measures)].sort();
};

/** Palabras del nombre, sin medidas ni unidades. */
export const materialWords = (name: string): string =>
  foldAccents(name)
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !NOISE_WORDS.has(word))
    .join(' ');

export type MeasureRelation = 'equal' | 'subset' | 'different' | 'none';

/**
 * Como se relacionan las medidas de dos nombres.
 *   equal     mismas medidas -> pueden ser el mismo material
 *   subset    uno es mas especifico -> puede serlo, lo decide una persona
 *   different -> NO son el mismo material
 *   none      ninguno declara medidas -> decide el nombre
 */
export const compareMeasures = (a: string, b: string): MeasureRelation => {
  const left = materialMeasures(a);
  const right = materialMeasures(b);

  if (left.length === 0 && right.length === 0) return 'none';
  if (left.length === 0 || right.length === 0) return 'subset';

  const leftSet = new Set(left);
  const rightSet = new Set(right);

  const leftInRight = left.every((measure) => rightSet.has(measure));
  const rightInLeft = right.every((measure) => leftSet.has(measure));

  if (leftInRight && rightInLeft) return 'equal';
  if (leftInRight || rightInLeft) return 'subset';

  return 'different';
};
