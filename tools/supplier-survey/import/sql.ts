/**
 * SQL del import de la planilla.
 *
 * Mismo criterio que el del scraper: no escribe nada por su cuenta, emite un
 * archivo idempotente para revisar y correr. Los ids de las filas nuevas son
 * deterministicos (ver ids.ts), asi que `on conflict (id) do nothing` alcanza
 * para que reimportar la planilla no duplique.
 */

import { quote, quoteJsonb, quoteNumber } from '../persist/sql.ts';
import type { ImportPlan } from './plan.ts';

export interface ImportSqlOptions {
  sourceName: string;
  /** Email del usuario al que se atribuye la carga. Null = el primero. */
  actorEmail?: string | null;
  /** De donde salio la planilla, para dejarlo escrito. */
  sourceFile: string;
}

const header = (plan: ImportPlan, options: ImportSqlOptions): string[] => [
  '-- Carga de la planilla de proveedores de insumos de refrigeracion (AMBA)',
  `-- Planilla:  ${options.sourceFile}`,
  `-- Relevado:  ${plan.surveyDate.slice(0, 10)}`,
  '--',
  `-- Tiendas nuevas al catalogo:   ${plan.storeInserts.length}`,
  `-- Tiendas ya existentes:        ${plan.storeUpdates.length}`,
  `-- Candidatos a revisar:         ${plan.candidates.length}`,
  `-- Materiales nuevos:            ${plan.itemInserts.length}`,
  `-- Observaciones de precio:      ${plan.priceInserts.length}`,
  '--',
  '-- Idempotente: se puede correr mas de una vez.',
  '-- Requiere la migracion 202609080001_supplier_survey.sql aplicada, y que se',
  '-- haya corrido en una transaccion ANTERIOR (usa el valor de enum "scraper").',
  '',
  'begin;',
  '',
  '-- Identidad para los triggers de integridad y auditoria.',
  'do $$',
  'declare',
  '  v_user_id uuid;',
  'begin',
  options.actorEmail
    ? `  select id into v_user_id from auth.users where email = ${quote(options.actorEmail)} limit 1;`
    : '  select id into v_user_id from auth.users order by created_at asc limit 1;',
  '',
  '  if v_user_id is null then',
  `    raise exception 'No hay usuario para atribuir la carga.';`,
  '  end if;',
  '',
  `  perform set_config('request.jwt.claim.sub', v_user_id::text, true);`,
  `  perform set_config('request.jwt.claim.role', 'authenticated', true);`,
  'end $$;',
  '',
  '-- ------------------------------------------------------------------',
  '-- La carga, registrada como una corrida mas',
  '-- ------------------------------------------------------------------',
  '',
  'insert into public.supplier_survey_runs (id, started_at, finished_at, status, mode, stats, config)',
  `values (${quote(plan.runId)}, ${quote(plan.surveyDate)}, ${quote(plan.surveyDate)}, 'completed', 'import',`,
  `  ${quoteJsonb({
    tiendasNuevas: plan.storeInserts.length,
    tiendasActualizadas: plan.storeUpdates.length,
    candidatos: plan.candidates.length,
    materiales: plan.itemInserts.length,
    precios: plan.priceInserts.length,
    preciosOmitidos: plan.skippedPrices.length,
  })}, ${quoteJsonb({ planilla: options.sourceFile, relevado: plan.surveyDate })})`,
  'on conflict (id) do update set stats = excluded.stats, config = excluded.config;',
  '',
];

const storeInsertsSection = (plan: ImportPlan, options: ImportSqlOptions): string[] => {
  if (plan.storeInserts.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Tiendas nuevas',
    '-- ------------------------------------------------------------------',
    '-- Son las de la hoja "Tiendas AMBA": publican precios y esos precios se',
    '-- cargan mas abajo, asi que la tienda tiene que existir. El resto de las',
    '-- hojas va a supplier_candidates, para que decidas cuales usar.',
    '',
  ];

  for (const store of plan.storeInserts) {
    lines.push(
      `-- ${store.name} (${store.canonicalDomain})`,
      'insert into public.stores (id, name, address, phone, website, canonical_domain, description, notes,',
      '  source, source_type, source_url, last_scraped_at, scraped_snapshot)',
      `values (${quote(store.id)}, ${quote(store.name)}, ${quote(store.address)}, ${quote(store.phone)},`,
      `  ${quote(store.website)}, ${quote(store.canonicalDomain)}, ${quote(store.description)}, ${quote(store.notes)},`,
      `  ${quote(options.sourceName)}, 'automated', ${quote(store.website)}, ${quote(plan.surveyDate)}, ${quoteJsonb(store.scrapedSnapshot)})`,
      'on conflict (id) do nothing;',
      '',
    );
  }

  return lines;
};

const storeUpdatesSection = (plan: ImportPlan): string[] => {
  if (plan.storeUpdates.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Tiendas que ya estaban: merge a tres vias',
    '-- ------------------------------------------------------------------',
    '-- Solo se completan campos vacios. Lo que cargaste a mano no se toca:',
    '-- los conflictos quedan listados como comentario y en el reporte.',
    '',
  ];

  for (const update of plan.storeUpdates) {
    const assignments = Object.entries(update.changes).map(([field, value]) => `  ${field} = ${quote(value)}`);

    assignments.push(`  source_url = ${quote(update.sourceUrl)}`);
    assignments.push(`  last_scraped_at = ${quote(plan.surveyDate)}`);
    assignments.push(`  scraped_snapshot = ${quoteJsonb(update.nextSnapshot)}`);

    lines.push(
      `-- ${update.storeName} (${update.canonicalDomain})`,
      ...update.conflicts.map(
        (conflict) =>
          `--   CONFLICTO en ${conflict.fieldName}: la base dice ${JSON.stringify(conflict.current)}, la planilla ${JSON.stringify(conflict.incoming)}. No se escribe.`,
      ),
      'update public.stores set',
      assignments.join(',\n'),
      `where id = ${quote(update.storeId)};`,
      '',
    );
  }

  return lines;
};

const candidatesSection = (plan: ImportPlan): string[] => {
  if (plan.candidates.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Candidatos a revisar',
    '-- ------------------------------------------------------------------',
    '-- Proveedores reales, pero nadie decidio todavia si el equipo los usa.',
    '--   select * from public.supplier_review_queue order by name;',
    "--   select public.promote_supplier_candidate('<id>');   -- lo suma al catalogo",
    "--   select public.discard_supplier_candidate('<id>', 'motivo');",
    '',
  ];

  for (const candidate of plan.candidates) {
    const { company } = candidate;

    lines.push(
      'insert into public.supplier_candidates (',
      '  run_id, source_url, canonical_domain, fingerprint, name, address, phone, website, description, notes,',
      '  categories, relevance_score, match_store_id, match_confidence, match_reason, decision, scraped_at',
      ') values (',
      `  ${quote(plan.runId)}, ${quote(company.sourceUrl)}, ${quote(company.canonicalDomain)}, ${quote(company.fingerprint)},`,
      `  ${quote(company.name)}, ${quote(company.address)}, ${quote(company.phone)}, ${quote(company.website)},`,
      `  ${quote(company.description)}, ${quote(candidate.notes)},`,
      `  array[${quote(candidate.tier)}]::text[], ${quoteNumber(company.relevanceScore)},`,
      `  ${quote(candidate.matchStoreId)}, ${quoteNumber(candidate.matchConfidence)}, ${quote(candidate.matchReason)},`,
      `  ${quote(candidate.decision)}, ${quote(company.scrapedAt)}`,
      ')',
      'on conflict (run_id, fingerprint) do nothing;',
      '',
    );
  }

  return lines;
};

const itemsSection = (plan: ImportPlan, options: ImportSqlOptions): string[] => {
  if (plan.itemInserts.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Materiales',
    '-- ------------------------------------------------------------------',
    '-- Un item por combinacion de material + presentacion + unidad. "Por metro"',
    '-- y "Rollo 15 m" son dos items: se compran distinto y se comparan aparte.',
    '',
  ];

  for (const item of plan.itemInserts) {
    lines.push(
      'insert into public.items (id, name, category, unit, item_type, variant_label,',
      '  presentation_quantity, presentation_unit, source, source_type, last_scraped_at)',
      `values (${quote(item.id)}, ${quote(item.name)}, ${quote(item.category)}, ${quote(item.unit)}, 'material',`,
      `  ${quote(item.variantLabel)}, ${quoteNumber(item.presentationQuantity)}, ${quote(item.presentationUnit)},`,
      `  ${quote(options.sourceName)}, 'automated', ${quote(plan.surveyDate)})`,
      'on conflict (id) do nothing;',
      '',
    );
  }

  return lines;
};

const pricesSection = (plan: ImportPlan): string[] => {
  if (plan.priceInserts.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Observaciones de precio',
    '-- ------------------------------------------------------------------',
    '-- `price` es el precio POR UNIDAD, que es lo que la app multiplica por la',
    '-- cantidad al armar un trabajo. Cuando la tienda vende por rollo o paquete,',
    '-- el precio publicado queda en las notas y la presentacion en',
    '-- `quantity_reference`.',
    '--',
    '-- Insertar aca no pisa ningun precio cargado a mano: la tabla es un',
    '-- historico y esto agrega una observacion mas, fechada y con su fuente.',
    '',
  ];

  for (const price of plan.priceInserts) {
    lines.push(
      `-- ${price.itemName} @ ${price.storeName}`,
      'insert into public.store_item_prices (store_id, item_id, price, currency, observed_at, source_type,',
      '  quantity_reference, notes, source_url, external_ref)',
      `values (${quote(price.storeId)}, ${quote(price.itemId)}, ${quoteNumber(price.price)}, ${quote(price.currency)},`,
      `  ${quote(price.observedAt)}, 'scraper', ${quote(price.quantityReference)}, ${quote(price.notes)},`,
      `  ${quote(price.sourceUrl)}, ${quote(price.externalRef)})`,
      'on conflict (external_ref) where external_ref is not null do nothing;',
      '',
    );
  }

  return lines;
};

export const renderImportSql = (plan: ImportPlan, options: ImportSqlOptions): string =>
  [
    ...header(plan, options),
    ...storeInsertsSection(plan, options),
    ...storeUpdatesSection(plan),
    ...candidatesSection(plan),
    ...itemsSection(plan, options),
    ...pricesSection(plan),
    'commit;',
    '',
  ].join('\n');
