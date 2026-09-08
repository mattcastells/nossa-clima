/**
 * De `RawCompany` (lo que dijo el sitio) a `NormalizedCompany` (lo que podemos
 * comparar y guardar).
 *
 * Aca se pierde informacion a proposito: el telefono queda en un formato, la
 * direccion en una linea, el nombre recortado. Lo que se descarta queda en
 * `raw` para poder auditarlo despues.
 */

import type { NormalizedCompany, Provenance, RawCompany } from '../core/types.ts';
import { companyFingerprint } from '../dedupe/fingerprint.ts';
import { canonicalDomain, canonicalUrl } from './domain.ts';
import { formatPhone } from './phone.ts';
import { cleanText, truncate } from './text.ts';

/** Topes alineados con lo que la UI muestra comodo en una ficha de tienda. */
const LIMITS = { name: 120, description: 300, address: 200, email: 160 } as const;

export interface NormalizeCompanyInput {
  raw: RawCompany;
  sourceUrl: string;
  scrapedAt: string;
  relevanceScore: number;
  categories?: readonly string[];
}

const takeProvenance = (
  provenance: Record<string, Provenance>,
  key: string,
  candidate: { provenance: Provenance } | undefined,
): void => {
  if (candidate) provenance[key] = candidate.provenance;
};

export const normalizeCompany = ({
  raw,
  sourceUrl,
  scrapedAt,
  relevanceScore,
  categories = [],
}: NormalizeCompanyInput): NormalizedCompany | null => {
  const domain = canonicalDomain(sourceUrl);
  if (!domain) return null;

  const provenance: Record<string, Provenance> = {};

  const rawName = cleanText(raw.name?.value) ?? cleanText(raw.legalName?.value);
  const name = rawName ? truncate(rawName, LIMITS.name) : null;
  takeProvenance(provenance, 'name', raw.name ?? raw.legalName);

  const rawDescription = cleanText(raw.description?.value);
  const description = rawDescription ? truncate(rawDescription, LIMITS.description) : null;
  takeProvenance(provenance, 'description', raw.description);

  const rawAddress = cleanText(raw.address?.value);
  const address = rawAddress ? truncate(rawAddress, LIMITS.address) : null;
  takeProvenance(provenance, 'address', raw.address);

  const phone = formatPhone(raw.phone?.value);
  takeProvenance(provenance, 'phone', raw.phone);

  const rawEmail = cleanText(raw.email?.value)?.toLowerCase() ?? null;
  const email = rawEmail && rawEmail.length <= LIMITS.email && rawEmail.includes('@') ? rawEmail : null;
  takeProvenance(provenance, 'email', raw.email);

  // La web declarada tiene que ser del mismo dominio; si no, es un enlace a
  // otra cosa (una red social, el sitio del fabricante) y no la tomamos.
  const declaredWebsite = raw.website?.value ? canonicalUrl(raw.website.value) : null;
  const website =
    declaredWebsite && canonicalDomain(declaredWebsite) === domain ? declaredWebsite : `https://${domain}`;
  takeProvenance(provenance, 'website', raw.website);

  const allCategories = [...new Set([...(raw.categories?.value ?? []), ...categories].map((entry) => entry.trim()).filter(Boolean))];

  return {
    name,
    description,
    address,
    phone,
    email,
    website,
    canonicalDomain: domain,
    categories: allCategories,
    fingerprint: companyFingerprint(domain, name),
    relevanceScore,
    sourceUrl,
    scrapedAt,
    provenance,
    raw: toRawRecord(raw),
  };
};

/** Guarda el valor crudo de cada campo con su estrategia, para auditoria. */
const toRawRecord = (raw: RawCompany): Record<string, unknown> => {
  const record: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (!value) continue;
    record[key] = { value: value.value, strategy: value.provenance.strategy, sourceUrl: value.provenance.sourceUrl };
  }

  return record;
};

/**
 * Una empresa sin nombre no sirve para nada: no se puede mostrar, ni comparar,
 * ni aprobar. El dominio solo tampoco alcanza como nombre.
 */
export const isUsableCompany = (company: NormalizedCompany): boolean =>
  company.name !== null && company.name.trim().length >= 2;
