/**
 * Reporte de la corrida.
 *
 * Dos formatos con el mismo contenido: JSON para que lo lea una herramienta, y
 * Markdown para que lo lea una persona (y para pegarlo en un issue de GitHub).
 *
 * Tiene que contestar, sin abrir nada mas:
 *   cuantos sitios se procesaron, cuantos se actualizaron, cuantos fallaron y
 *   por que, cuantas empresas nuevas hay, cuantos duplicados, que registros
 *   cambiaron, cuales necesitan que alguien los mire, y de que URL salio cada
 *   dato.
 */

import type { SyncPlan } from '../core/types.ts';

export interface ReportSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  mode: string;

  sitios: {
    total: number;
    ok: number;
    sinCambios: number;
    omitidos: number;
    fallidos: number;
  };

  empresas: {
    actualizadas: number;
    nuevas: number;
    duplicadas: number;
    aRevisar: number;
    irrelevantes: number;
  };

  productos: {
    total: number;
    conPrecio: number;
    preciosAInsertar: number;
    aRevisar: number;
  };

  discovery: SyncPlan['discoveryStats'];
}

export interface SurveyReport {
  summary: ReportSummary;
  /** Un item por cada cosa que necesita decision humana. */
  revisionManual: Array<{
    tipo: 'empresa' | 'conflicto' | 'producto';
    dominio: string;
    detalle: string;
    fuente: string;
  }>;
  fallos: Array<{ dominio: string; url: string; motivo: string }>;
  cambios: Array<{ tienda: string; dominio: string; campos: Record<string, string | null>; fuente: string }>;
  fuentes: Array<{ dominio: string; url: string; metodo: string; paginas: number; estado: string }>;
}

export const buildReport = (plan: SyncPlan): SurveyReport => {
  const durationSeconds = Math.round(
    (new Date(plan.finishedAt).getTime() - new Date(plan.startedAt).getTime()) / 1000,
  );

  const countDecision = (decision: string): number =>
    plan.companyCandidates.filter((candidate) => candidate.decision === decision).length;

  const summary: ReportSummary = {
    runId: plan.runId,
    startedAt: plan.startedAt,
    finishedAt: plan.finishedAt,
    durationSeconds,
    mode: plan.mode,

    sitios: {
      total: plan.siteResults.length,
      ok: plan.siteResults.filter((result) => result.status === 'ok').length,
      sinCambios: plan.siteResults.filter((result) => result.status === 'unchanged').length,
      omitidos: plan.siteResults.filter((result) => result.status === 'skipped').length,
      fallidos: plan.siteResults.filter((result) => result.status === 'failed').length,
    },

    empresas: {
      actualizadas: plan.storeUpdates.length,
      nuevas: countDecision('new'),
      duplicadas: countDecision('duplicate'),
      aRevisar: countDecision('needs_review'),
      irrelevantes: countDecision('irrelevant'),
    },

    productos: {
      total: plan.productCandidates.length,
      conPrecio: plan.productCandidates.filter((candidate) => candidate.product.price !== null).length,
      preciosAInsertar: plan.productCandidates.filter((candidate) => candidate.priceReady).length,
      aRevisar: plan.productCandidates.filter((candidate) => candidate.decision === 'needs_review').length,
    },

    discovery: plan.discoveryStats,
  };

  const revisionManual: SurveyReport['revisionManual'] = [];

  for (const candidate of plan.companyCandidates) {
    if (candidate.decision === 'new') {
      revisionManual.push({
        tipo: 'empresa',
        dominio: candidate.company.canonicalDomain,
        detalle: `Empresa nueva: ${candidate.company.name ?? 'sin nombre'} (relevancia ${candidate.company.relevanceScore})`,
        fuente: candidate.company.sourceUrl,
      });
      continue;
    }

    if (candidate.decision === 'needs_review') {
      revisionManual.push({
        tipo: 'empresa',
        dominio: candidate.company.canonicalDomain,
        detalle: `Posible duplicado (${candidate.matchConfidence}%): ${candidate.matchReason}`,
        fuente: candidate.company.sourceUrl,
      });
    }
  }

  for (const update of plan.storeUpdates) {
    for (const conflict of update.conflicts) {
      revisionManual.push({
        tipo: 'conflicto',
        dominio: update.canonicalDomain,
        detalle: `${update.storeName} · ${conflict.fieldName}: la base tiene ${JSON.stringify(conflict.current)}, el sitio ${JSON.stringify(conflict.incoming)}`,
        fuente: update.sourceUrl,
      });
    }
  }

  for (const candidate of plan.productCandidates) {
    if (candidate.decision !== 'needs_review') continue;
    revisionManual.push({
      tipo: 'producto',
      dominio: candidate.product.canonicalDomain,
      detalle: `${candidate.product.name}: coincidencia con item al ${candidate.matchConfidence}% (${candidate.matchReason})`,
      fuente: candidate.product.sourceUrl,
    });
  }

  return {
    summary,
    revisionManual,
    fallos: plan.siteResults
      .filter((result) => result.status === 'failed')
      .map((result) => ({
        dominio: result.site.canonicalDomain,
        url: result.site.url,
        motivo: result.error ?? 'sin detalle',
      })),
    cambios: plan.storeUpdates
      .filter((update) => Object.keys(update.changes).length > 0)
      .map((update) => ({
        tienda: update.storeName,
        dominio: update.canonicalDomain,
        campos: update.changes,
        fuente: update.sourceUrl,
      })),
    fuentes: plan.siteResults.map((result) => ({
      dominio: result.site.canonicalDomain,
      url: result.site.url,
      metodo: result.site.discoveryMethod,
      paginas: result.pagesFetched.length,
      estado: result.status,
    })),
  };
};

const table = (headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string[] => {
  if (rows.length === 0) return [];
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
    '',
  ];
};

export const renderMarkdown = (report: SurveyReport): string => {
  const { summary } = report;

  const lines: string[] = [
    `# Relevamiento de proveedores — ${summary.finishedAt.slice(0, 10)}`,
    '',
    `Corrida \`${summary.runId}\` · modo \`${summary.mode}\` · ${summary.durationSeconds}s`,
    '',
    '## Resumen',
    '',
    ...table(
      ['Sitios', 'OK', 'Sin cambios', 'Omitidos', 'Fallidos'],
      [
        [
          String(summary.sitios.total),
          String(summary.sitios.ok),
          String(summary.sitios.sinCambios),
          String(summary.sitios.omitidos),
          String(summary.sitios.fallidos),
        ],
      ],
    ),
    ...table(
      ['Actualizadas', 'Nuevas', 'Duplicadas', 'A revisar', 'Irrelevantes'],
      [
        [
          String(summary.empresas.actualizadas),
          String(summary.empresas.nuevas),
          String(summary.empresas.duplicadas),
          String(summary.empresas.aRevisar),
          String(summary.empresas.irrelevantes),
        ],
      ],
    ),
    ...table(
      ['Productos', 'Con precio', 'Precios a insertar', 'A revisar'],
      [
        [
          String(summary.productos.total),
          String(summary.productos.conPrecio),
          String(summary.productos.preciosAInsertar),
          String(summary.productos.aRevisar),
        ],
      ],
    ),
  ];

  if (summary.discovery.queriesRun > 0 || summary.discovery.resultsSeen > 0) {
    lines.push(
      '## Discovery',
      '',
      `Proveedor \`${summary.discovery.provider}\` · ${summary.discovery.queriesRun} consulta(s)`,
      '',
      ...table(
        ['Resultados', 'Dominios', 'Ya conocidos', 'Descartados', 'Nuevos'],
        [
          [
            String(summary.discovery.resultsSeen),
            String(summary.discovery.domainsSeen),
            String(summary.discovery.alreadyKnown),
            String(summary.discovery.rejectedIrrelevant),
            String(summary.discovery.newDomains),
          ],
        ],
      ),
    );
  }

  if (report.cambios.length > 0) {
    lines.push(
      '## Registros que cambiaron',
      '',
      ...table(
        ['Tienda', 'Campo', 'Nuevo valor', 'Fuente'],
        report.cambios.flatMap((cambio) =>
          Object.entries(cambio.campos).map(([campo, valor]) => [
            cambio.tienda,
            campo,
            valor === null ? '(vacio)' : valor,
            cambio.fuente,
          ]),
        ),
      ),
    );
  }

  if (report.revisionManual.length > 0) {
    lines.push(
      '## Requieren revision manual',
      '',
      ...table(
        ['Tipo', 'Dominio', 'Detalle', 'Fuente'],
        report.revisionManual.map((item) => [item.tipo, item.dominio, item.detalle, item.fuente]),
      ),
    );
  } else {
    lines.push('## Requieren revision manual', '', 'Nada pendiente.', '');
  }

  if (report.fallos.length > 0) {
    lines.push(
      '## Sitios que fallaron',
      '',
      ...table(
        ['Dominio', 'Motivo', 'URL'],
        report.fallos.map((fallo) => [fallo.dominio, fallo.motivo, fallo.url]),
      ),
    );
  }

  lines.push(
    '## Fuentes procesadas',
    '',
    ...table(
      ['Dominio', 'Metodo', 'Paginas', 'Estado', 'URL'],
      report.fuentes.map((fuente) => [
        fuente.dominio,
        fuente.metodo,
        String(fuente.paginas),
        fuente.estado,
        fuente.url,
      ]),
    ),
  );

  return lines.join('\n');
};
