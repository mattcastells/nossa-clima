/**
 * Telefonos argentinos.
 *
 * Sirven para dos cosas distintas y no hay que confundirlas:
 *   - `formatPhone`  -> lo que se muestra y se guarda en `stores.phone`.
 *   - `phoneKey`     -> solo digitos significativos, para deduplicar.
 *
 * `11 4571-2411`, `+54 11 4571 2411` y `(011) 4571-2411` son el mismo telefono
 * y tienen que dar la misma `phoneKey`, o el matching por telefono no sirve.
 */

const DIGITS = /\d/g;

/** Solo los digitos de una cadena. */
const onlyDigits = (raw: string): string => (raw.match(DIGITS) ?? []).join('');

/**
 * Clave de comparacion: sin prefijo de pais, sin 0 de larga distancia y sin el
 * 15 de celular. Devuelve null si no queda algo que pueda ser un telefono AR.
 */
export const phoneKey = (raw: string | null | undefined): string | null => {
  if (typeof raw !== 'string') return null;

  let digits = onlyDigits(raw);
  if (digits.length === 0) return null;

  // Prefijo internacional argentino.
  if (digits.startsWith('0054')) digits = digits.slice(4);
  else if (digits.startsWith('54')) digits = digits.slice(2);

  // 0 de larga distancia nacional.
  if (digits.startsWith('0')) digits = digits.slice(1);

  // 9 de celular en formato internacional.
  if (digits.length === 11 && digits.startsWith('9')) digits = digits.slice(1);

  // 15 de celular en formato local: 11 15 4571 2411.
  if (digits.length === 12 && digits.startsWith('11') && digits.slice(2, 4) === '15') {
    digits = `11${digits.slice(4)}`;
  }

  // Un numero nacional util tiene 10 digitos (area + abonado). Aceptamos 8 a 11
  // para no perder numeros locales sin area, que igual sirven de senal debil.
  if (digits.length < 8 || digits.length > 11) return null;

  return digits;
};

/**
 * Un texto puede traer varios telefonos pegados: `1147023044/1169308918`.
 * Devuelve todas las claves distintas encontradas.
 */
export const phoneKeys = (raw: string | null | undefined): string[] => {
  if (typeof raw !== 'string') return [];

  const chunks = raw.split(/[/;,\n]|\so\s|\sy\s/i);
  const keys = new Set<string>();

  for (const chunk of chunks) {
    const key = phoneKey(chunk);
    if (key) keys.add(key);
  }

  // Si no partio en pedazos utiles, probamos el texto entero.
  if (keys.size === 0) {
    const whole = phoneKey(raw);
    if (whole) keys.add(whole);
  }

  return [...keys];
};

/** Formato de presentacion: `11 4571-2411`. Si no reconoce el patron, limpia y devuelve. */
export const formatPhone = (raw: string | null | undefined): string | null => {
  const key = phoneKey(raw);
  if (!key) {
    if (typeof raw !== 'string') return null;
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  if (key.length === 10) {
    // CABA y GBA: area de 2 digitos. Resto del pais: 3 o 4.
    const areaLength = key.startsWith('11') ? 2 : /^(2|3)\d\d/.test(key) ? 3 : 4;
    const area = key.slice(0, areaLength);
    const rest = key.slice(areaLength);

    // El abonado se agrupa por derecha, no por la mitad: 477-5865, no 4775-865.
    const tail = rest.length >= 8 ? 4 : rest.length >= 7 ? 4 : 3;
    return `${area} ${rest.slice(0, rest.length - tail)}-${rest.slice(rest.length - tail)}`;
  }

  return key;
};

/** Extrae telefonos de un bloque de texto o HTML (incluye enlaces `tel:`). */
export const findPhones = (text: string): string[] => {
  const found = new Set<string>();

  for (const match of text.matchAll(/tel:\+?([\d\s().-]{7,20})/gi)) {
    const key = phoneKey(match[1] ?? '');
    if (key) found.add(key);
  }

  // Patron generico: opcional +54, area entre parentesis o no, y abonado de 6 a
  // 8 digitos. El abonado de 6 existe: (02320) 40-8440 es un numero real.
  for (const match of text.matchAll(/(?:\+?54[\s-]?)?(?:\(?0?\d{2,4}\)?[\s.-]?)\d{2,4}[\s.-]?\d{3,4}/g)) {
    const key = phoneKey(match[0]);
    if (key) found.add(key);
  }

  return [...found];
};
