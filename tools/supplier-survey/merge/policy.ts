/**
 * Que puede tocar el scraper y que no.
 *
 * Regla de fondo: **el dato de una persona le gana siempre al del scraper**.
 * Lo unico que el scraper hace por su cuenta es completar huecos y refrescar
 * valores que el mismo escribio antes. Cualquier otra cosa va a revision.
 */

export type FieldPolicy =
  /** El scraper completa si esta vacio y refresca lo que el mismo puso. */
  | 'managed'
  /** El scraper solo completa si esta vacio; despues nunca lo vuelve a tocar. */
  | 'fill-only'
  /** El scraper nunca escribe. Un cambio se reporta como conflicto. */
  | 'protected';

/**
 * Politica por campo de `stores`.
 *
 * `name` es proteccion de identidad: un cambio de nombre puede ser un rebranding
 * o puede ser que el matching se equivoco de empresa. Lo decide una persona.
 *
 * `description` y `notes` son del tecnico. En esta base `description` guarda el
 * horario de atencion ("8:30-12:30 - 14-16") y `notes` el celular del vendedor
 * que lo atiende. Pisar eso con el meta description del sitio seria destruir la
 * unica informacion que realmente se usa.
 */
export const STORE_FIELD_POLICY: Readonly<Record<string, FieldPolicy>> = {
  name: 'protected',
  notes: 'protected',
  description: 'protected',
  address: 'fill-only',
  phone: 'fill-only',
  website: 'managed',
  email: 'managed',
  canonical_domain: 'managed',
};

/** Campos que el scraper puede llegar a proponer, en orden de presentacion. */
export const STORE_MANAGED_FIELDS = ['website', 'email', 'address', 'phone', 'canonical_domain'] as const;

export type StoreManagedField = (typeof STORE_MANAGED_FIELDS)[number];

export const policyFor = (fieldName: string): FieldPolicy => STORE_FIELD_POLICY[fieldName] ?? 'protected';
