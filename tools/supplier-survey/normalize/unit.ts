/**
 * Unidades de medida.
 *
 * El catalogo de la app usa `mt` para metro; una planilla escribe "metro" y
 * otra "mts". Si no se unifica, el buscador de materiales termina con
 * "Caño 1/4 (mt)" y "Cano de cobre 1/4 (metro)" como cosas distintas.
 *
 * `canonicalUnit` devuelve la forma que ya usa la base, no una forma ideal:
 * el catalogo existente manda.
 */

const ALIASES: Record<string, string> = {
  // Longitud. La app ya tiene cargado 'mt'.
  m: 'mt',
  mt: 'mt',
  mts: 'mt',
  metro: 'mt',
  metros: 'mt',
  ml: 'mt',
  // Peso.
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  g: 'g',
  gr: 'g',
  gramo: 'g',
  gramos: 'g',
  // Volumen.
  l: 'l',
  lt: 'l',
  lts: 'l',
  litro: 'l',
  litros: 'l',
  // Conteo y presentaciones.
  u: 'unidad',
  un: 'unidad',
  uni: 'unidad',
  unidad: 'unidad',
  unidades: 'unidad',
  par: 'par',
  pares: 'par',
  juego: 'juego',
  juegos: 'juego',
  kit: 'kit',
  kits: 'kit',
  rollo: 'rollo',
  rollos: 'rollo',
  tira: 'tira',
  tiras: 'tira',
  caja: 'caja',
  cajas: 'caja',
  pack: 'pack',
};

export const canonicalUnit = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null;

  const key = raw
    .trim()
    .toLowerCase()
    .replace(/[.()]/g, '')
    .trim();

  if (key.length === 0) return null;
  return ALIASES[key] ?? key;
};

/** ¿Son la misma unidad? `metro` y `mt` si; `metro` y `rollo` no. */
export const unitsMatch = (a: string | null | undefined, b: string | null | undefined): boolean => {
  const left = canonicalUnit(a);
  const right = canonicalUnit(b);
  if (left === null || right === null) return false;
  return left === right;
};
