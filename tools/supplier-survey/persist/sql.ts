/**
 * Escritura del plan como SQL idempotente.
 *
 * El pipeline no escribe en la base: emite un archivo que una persona revisa y
 * corre en el SQL editor de Supabase. Eso hace que una corrida automatica no
 * pueda tocar produccion sin que alguien lo haya leido, y deja el diff a la
 * vista.
 *
 * El archivo se puede correr las veces que haga falta:
 *   - los INSERT llevan `on conflict do nothing` / `do update`;
 *   - los UPDATE son asignaciones directas por id;
 *   - las observaciones de precio se deduplican por `external_ref`.
 *
 * Sobre `set_config`: en el SQL editor de Supabase el rol es `postgres` y
 * `auth.uid()` es null, asi que los triggers de integridad (`prices_set_user_id`,
 * `set_shared_catalog_audit_fields`) fallarian. Se setean los claims del JWT
 * como ya lo hace `supabase/seed/seed_nossa_clima.sql`.
 */

import type { SyncPlan } from '../core/types.ts';

/** Escapa un literal de texto para SQL. Null se escribe como `null`. */
export const quote = (value: string | null | undefined): string => {
  if (value === null || value === undefined) return 'null';
  return `'${value.replace(/'/g, "''")}'`;
};

export const quoteNumber = (value: number | null | undefined): string =>
  value === null || value === undefined || !Number.isFinite(value) ? 'null' : String(value);

export const quoteJsonb = (value: unknown): string => `${quote(JSON.stringify(value))}::jsonb`;

export const quoteTextArray = (values: readonly string[]): string => {
  if (values.length === 0) return `'{}'::text[]`;
  return `array[${values.map((value) => quote(value)).join(', ')}]::text[]`;
};

export interface SqlWriterOptions {
  sourceName: string;
  /** Email del usuario cuya identidad se usa para los triggers. Null = el primero. */
  actorEmail?: string | null;
}

const header = (plan: SyncPlan, options: SqlWriterOptions): string[] => {
  const priceInserts = plan.productCandidates.filter((candidate) => candidate.priceReady).length;

  return [
    '-- Relevamiento de proveedores de aire acondicionado',
    `-- Corrida:   ${plan.runId}`,
    `-- Modo:      ${plan.mode}`,
    `-- Generado:  ${plan.finishedAt}`,
    '--',
    `-- Sitios relevados:            ${plan.siteResults.length}`,
    `-- Tiendas a actualizar:        ${plan.storeUpdates.length}`,
    `-- Candidatos de empresa:       ${plan.companyCandidates.length}`,
    `-- Candidatos de producto:      ${plan.productCandidates.length}`,
    `-- Observaciones de precio:     ${priceInserts}`,
    '--',
    '-- Revisar antes de ejecutar. Es idempotente: se puede correr mas de una vez.',
    `-- Requiere la migracion 202609080001_supplier_survey.sql aplicada.`,
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
    `    raise exception 'No hay usuario para atribuir el relevamiento.';`,
    '  end if;',
    '',
    `  perform set_config('request.jwt.claim.sub', v_user_id::text, true);`,
    `  perform set_config('request.jwt.claim.role', 'authenticated', true);`,
    'end $$;',
    '',
  ];
};

const runSection = (plan: SyncPlan): string[] => {
  const stats = {
    sitios: plan.siteResults.length,
    ok: plan.siteResults.filter((result) => result.status === 'ok').length,
    sinCambios: plan.siteResults.filter((result) => result.status === 'unchanged').length,
    omitidos: plan.siteResults.filter((result) => result.status === 'skipped').length,
    fallidos: plan.siteResults.filter((result) => result.status === 'failed').length,
    tiendasActualizadas: plan.storeUpdates.length,
    empresasNuevas: plan.companyCandidates.filter((candidate) => candidate.decision === 'new').length,
    duplicados: plan.companyCandidates.filter((candidate) => candidate.decision === 'duplicate').length,
    aRevisar: plan.companyCandidates.filter((candidate) => candidate.decision === 'needs_review').length,
    descubrimiento: plan.discoveryStats,
  };

  return [
    '-- ------------------------------------------------------------------',
    '-- Corrida',
    '-- ------------------------------------------------------------------',
    '',
    'insert into public.supplier_survey_runs (id, started_at, finished_at, status, mode, stats)',
    `values (${quote(plan.runId)}, ${quote(plan.startedAt)}, ${quote(plan.finishedAt)}, 'completed', ${quote(plan.mode)}, ${quoteJsonb(stats)})`,
    'on conflict (id) do update set',
    '  finished_at = excluded.finished_at,',
    '  status = excluded.status,',
    '  stats = excluded.stats;',
    '',
  ];
};

const sourcesSection = (plan: SyncPlan): string[] => {
  if (plan.sources.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Fuentes relevadas',
    '-- ------------------------------------------------------------------',
    '',
  ];

  for (const source of plan.sources) {
    const result = plan.siteResults.find((entry) => entry.site.canonicalDomain === source.canonicalDomain);
    const failed = result?.status === 'failed';
    const httpStatus = failed ? 'null' : '200';

    lines.push(
      'insert into public.supplier_sources (url, canonical_domain, discovery_method, status, last_fetched_at, last_success_at, last_http_status, failure_count, notes)',
      `values (${quote(source.url)}, ${quote(source.canonicalDomain)}, ${quote(source.discoveryMethod)}, 'active', ${quote(plan.finishedAt)}, ${failed ? 'null' : quote(plan.finishedAt)}, ${httpStatus}, ${failed ? '1' : '0'}, ${quote(source.label ?? null)})`,
      'on conflict (canonical_domain) do update set',
      '  url = excluded.url,',
      '  last_fetched_at = excluded.last_fetched_at,',
      '  last_success_at = coalesce(excluded.last_success_at, public.supplier_sources.last_success_at),',
      '  last_http_status = excluded.last_http_status,',
      failed
        ? '  failure_count = public.supplier_sources.failure_count + 1;'
        : '  failure_count = 0;',
      '',
    );
  }

  return lines;
};

const storeUpdatesSection = (plan: SyncPlan): string[] => {
  if (plan.storeUpdates.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Tiendas conocidas: merge a tres vias',
    '-- ------------------------------------------------------------------',
    '-- Solo se escriben campos vacios o que el propio scraper habia escrito.',
    '-- Lo editado a mano no se toca: queda listado como conflicto en el reporte.',
    '',
  ];

  for (const update of plan.storeUpdates) {
    const assignments: string[] = [];

    for (const [fieldName, value] of Object.entries(update.changes)) {
      assignments.push(`  ${fieldName} = ${quote(value)}`);
    }

    // Trazabilidad. `source`/`source_type` NO se tocan: describen el origen de
    // la fila, y esta tienda la creo una persona. Que campos son del scraper lo
    // dice `scraped_snapshot`; que la miramos, `last_scraped_at`.
    assignments.push(`  source_url = ${quote(update.sourceUrl)}`);
    assignments.push(`  last_scraped_at = ${quote(plan.finishedAt)}`);
    assignments.push(`  scraped_snapshot = ${quoteJsonb(update.nextSnapshot)}`);

    lines.push(
      `-- ${update.storeName} (${update.canonicalDomain})`,
      ...(update.conflicts.length > 0
        ? update.conflicts.map(
            (conflict) =>
              `--   CONFLICTO en ${conflict.fieldName}: la base dice ${JSON.stringify(conflict.current)}, el sitio ${JSON.stringify(conflict.incoming)}. No se escribe.`,
          )
        : []),
      'update public.stores set',
      assignments.join(',\n'),
      `where id = ${quote(update.storeId)};`,
      '',
    );
  }

  return lines;
};

const companyCandidatesSection = (plan: SyncPlan): string[] => {
  if (plan.companyCandidates.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Candidatos de empresa (staging)',
    '-- ------------------------------------------------------------------',
    '-- Nada de esto entra a `stores` automaticamente. Revisar con:',
    '--   select * from public.supplier_review_queue order by relevance_score desc;',
    '--',
    '-- Aprobar uno:  select public.promote_supplier_candidate(\'<id>\');',
    '-- Descartarlo:  select public.discard_supplier_candidate(\'<id>\', \'motivo\');',
    '',
  ];

  for (const candidate of plan.companyCandidates) {
    const { company } = candidate;

    lines.push(
      'insert into public.supplier_candidates (',
      '  run_id, source_url, canonical_domain, fingerprint, name, address, phone, email, website,',
      '  description, categories, relevance_score, match_store_id, match_confidence, match_reason,',
      '  decision, diff, raw, scraped_at',
      ') values (',
      `  ${quote(plan.runId)}, ${quote(company.sourceUrl)}, ${quote(company.canonicalDomain)}, ${quote(company.fingerprint)},`,
      `  ${quote(company.name)}, ${quote(company.address)}, ${quote(company.phone)}, ${quote(company.email)}, ${quote(company.website)},`,
      `  ${quote(company.description)}, ${quoteTextArray(company.categories)}, ${quoteNumber(company.relevanceScore)},`,
      `  ${quote(candidate.matchStoreId)}, ${quoteNumber(candidate.matchConfidence)}, ${quote(candidate.matchReason)},`,
      `  ${quote(candidate.decision)}, ${quoteJsonb(candidate.diff)}, ${quoteJsonb(company.raw)}, ${quote(company.scrapedAt)}`,
      ')',
      'on conflict (run_id, fingerprint) do nothing;',
      '',
    );
  }

  return lines;
};

const productCandidatesSection = (plan: SyncPlan): string[] => {
  if (plan.productCandidates.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Candidatos de producto (staging)',
    '-- ------------------------------------------------------------------',
    '',
  ];

  for (const candidate of plan.productCandidates) {
    const { product } = candidate;

    lines.push(
      'insert into public.supplier_product_candidates (',
      '  run_id, store_id, source_url, canonical_domain, external_ref, name, brand, sku, category,',
      '  unit, presentation_quantity, presentation_unit, price, currency, availability,',
      '  matched_item_id, match_confidence, match_reason, decision, scraped_at',
      ') values (',
      `  ${quote(plan.runId)}, ${quote(candidate.storeId)}, ${quote(product.sourceUrl)}, ${quote(product.canonicalDomain)},`,
      `  ${quote(product.externalRef)}, ${quote(product.name)}, ${quote(product.brand)}, ${quote(product.sku)}, ${quote(product.category)},`,
      `  ${quote(product.unit)}, ${quoteNumber(product.presentationQuantity)}, ${quote(product.presentationUnit)},`,
      `  ${quoteNumber(product.price)}, ${quote(product.currency)}, ${quote(product.availability)},`,
      `  ${quote(candidate.matchedItemId)}, ${quoteNumber(candidate.matchConfidence)}, ${quote(candidate.matchReason)},`,
      `  ${quote(candidate.decision)}, ${quote(product.scrapedAt)}`,
      ')',
      'on conflict (run_id, external_ref) do nothing;',
      '',
    );
  }

  return lines;
};

const pricesSection = (plan: SyncPlan): string[] => {
  const ready = plan.productCandidates.filter((candidate) => candidate.priceReady);
  if (ready.length === 0) return [];

  const lines = [
    '-- ------------------------------------------------------------------',
    '-- Observaciones de precio',
    '-- ------------------------------------------------------------------',
    '-- `store_item_prices` es un historico: insertar no pisa ningun precio',
    '-- cargado a mano, agrega una observacion mas con su fecha y su fuente.',
    '-- Solo entran los productos con tienda e item identificados con certeza.',
    '',
  ];

  for (const candidate of ready) {
    const { product } = candidate;

    lines.push(
      `-- ${product.name} (${product.canonicalDomain})`,
      'insert into public.store_item_prices (store_id, item_id, price, currency, observed_at, source_type, quantity_reference, source_url, external_ref)',
      `values (${quote(candidate.storeId)}, ${quote(candidate.matchedItemId)}, ${quoteNumber(product.price)}, ${quote(product.currency)}, ${quote(product.scrapedAt)}, 'scraper', ${quote(presentationLabel(product.presentationQuantity, product.presentationUnit))}, ${quote(product.sourceUrl)}, ${quote(product.externalRef)})`,
      'on conflict (external_ref) where external_ref is not null do nothing;',
      '',
    );
  }

  return lines;
};

const presentationLabel = (quantity: number | null, unit: string | null): string | null => {
  if (quantity === null || unit === null) return null;
  return `${quantity} ${unit}`;
};

const itemsProvenanceNote = (options: SqlWriterOptions): string[] => [
  '-- ------------------------------------------------------------------',
  '-- Nota sobre `items` y sobre el origen de las filas',
  '-- ------------------------------------------------------------------',
  '-- El scraper no crea items. Un item mal creado ensucia el buscador de',
  '-- materiales de toda la app. Los productos nuevos quedan en',
  '-- `supplier_product_candidates` con decision = new; al aprobarlos, el item',
  `-- se crea con source = '${options.sourceName}' y source_type = 'automated'.`,
  '--',
  '-- Los UPDATE de arriba NO cambian source/source_type: esas tiendas las creo',
  '-- una persona y siguen siendo suyas. Lo que aporto el relevamiento se lee en',
  '-- `scraped_snapshot` (que campos) y `last_scraped_at` (cuando).',
  '',
];

/** Genera el archivo SQL completo. */
export const renderSyncSql = (plan: SyncPlan, options: SqlWriterOptions): string => {
  const lines = [
    ...header(plan, options),
    ...runSection(plan),
    ...sourcesSection(plan),
    ...storeUpdatesSection(plan),
    ...companyCandidatesSection(plan),
    ...productCandidatesSection(plan),
    ...pricesSection(plan),
    ...itemsProvenanceNote(options),
    'commit;',
    '',
  ];

  return lines.join('\n');
};

