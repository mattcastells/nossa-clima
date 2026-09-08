/**
 * CLI del relevamiento.
 *
 *   node tools/supplier-survey/cli.ts run        relevamiento completo
 *   node tools/supplier-survey/cli.ts update     solo sitios conocidos
 *   node tools/supplier-survey/cli.ts discover   solo buscar nuevos
 *   node tools/supplier-survey/cli.ts import     carga una planilla xlsx relevada a mano
 *   node tools/supplier-survey/cli.ts snapshot   baja el estado de la base a disco
 *   node tools/supplier-survey/cli.ts report     reimprime el ultimo reporte
 *
 * Sin `--apply`: nunca escribe en la base. Deja un .sql para revisar y correr.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readAmbaWorkbook } from './import/ambaSheet.ts';
import { buildImportPlan, type ImportPlan } from './import/plan.ts';
import { renderImportSql } from './import/sql.ts';
import { readWorkbook } from './import/xlsx.ts';

import { buildConfig, readSupabaseCredentials, type ConfigOverrides, type SurveyConfig } from './config.ts';
import { createLogger, type LogLevel } from './core/logger.ts';
import { createRunContext } from './core/runContext.ts';
import type { DatabaseState, SourceSite } from './core/types.ts';
import { canonicalDomain, canonicalUrl } from './normalize/domain.ts';
import { buildReport, renderMarkdown } from './report/report.ts';
import { renderSyncSql } from './persist/sql.ts';
import {
  connectSupabase,
  emptyState,
  loadStateFromSupabase,
  loadStateSnapshot,
  saveStateSnapshot,
} from './persist/state.ts';
import { runPipeline, type SurveyMode } from './pipeline.ts';

interface ParsedArgs {
  command: string;
  flags: Map<string, string | boolean>;
}

const parseArgs = (argv: readonly string[]): ParsedArgs => {
  const [command = 'run', ...rest] = argv;
  const flags = new Map<string, string | boolean>();

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token || !token.startsWith('--')) continue;

    const [name, inlineValue] = token.slice(2).split('=', 2);
    if (!name) continue;

    if (inlineValue !== undefined) {
      flags.set(name, inlineValue);
      continue;
    }

    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      flags.set(name, next);
      index += 1;
      continue;
    }

    flags.set(name, true);
  }

  return { command, flags };
};

const flagString = (flags: ParsedArgs['flags'], name: string): string | undefined => {
  const value = flags.get(name);
  return typeof value === 'string' ? value : undefined;
};

const flagNumber = (flags: ParsedArgs['flags'], name: string): number | undefined => {
  const value = flagString(flags, name);
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const flagBoolean = (flags: ParsedArgs['flags'], name: string): boolean => flags.get(name) === true || flags.get(name) === 'true';

/** Lee `seeds/sources.json` y lo convierte en sitios. Tolera el archivo ausente. */
const loadSeeds = async (config: SurveyConfig): Promise<SourceSite[]> => {
  let content: string;
  try {
    content = await readFile(config.paths.seeds, 'utf8');
  } catch {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  const raw = parsed !== null && typeof parsed === 'object' && 'sources' in parsed ? (parsed as { sources: unknown }).sources : parsed;
  if (!Array.isArray(raw)) return [];

  const sites: SourceSite[] = [];

  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue;

    const record = entry as { url?: unknown; label?: unknown };
    if (typeof record.url !== 'string') continue;

    const url = canonicalUrl(record.url);
    const domain = canonicalDomain(record.url);
    if (!url || !domain) continue;

    sites.push({
      url,
      canonicalDomain: domain,
      discoveryMethod: 'seed',
      ...(typeof record.label === 'string' ? { label: record.label } : {}),
    });
  }

  return sites;
};

const loadQueries = async (config: SurveyConfig): Promise<string[]> => {
  try {
    const content = await readFile(config.paths.queries, 'utf8');
    const parsed: unknown = JSON.parse(content);
    const raw = parsed !== null && typeof parsed === 'object' && 'queries' in parsed ? (parsed as { queries: unknown }).queries : parsed;
    return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

interface ResolvedState {
  state: DatabaseState;
  migrationMissing: boolean;
  /** Cliente autenticado, si se pudo conectar. */
  client: Awaited<ReturnType<typeof connectSupabase>>;
}

/**
 * Estado de la base, en orden de preferencia:
 *   --state <archivo>  ->  snapshot en disco (offline, reproducible)
 *   credenciales       ->  Supabase
 *   nada               ->  estado vacio, con aviso
 */
const resolveState = async (
  flags: ParsedArgs['flags'],
  logger: ReturnType<typeof createLogger>,
): Promise<ResolvedState> => {
  const snapshotPath = flagString(flags, 'state');

  if (snapshotPath) {
    logger.info(`estado leido de ${snapshotPath}`);
    return { state: await loadStateSnapshot(snapshotPath), migrationMissing: false, client: null };
  }

  const credentials = readSupabaseCredentials();
  if (!credentials) {
    logger.warn(
      'sin credenciales de Supabase: corro contra un estado vacio. ' +
        'Todo va a figurar como empresa nueva. Configura SURVEY_SUPABASE_EMAIL / SURVEY_SUPABASE_PASSWORD, ' +
        'o pasa --state con un snapshot.',
    );
    return { state: emptyState(), migrationMissing: false, client: null };
  }

  const client = await connectSupabase(credentials, logger);
  if (!client) return { state: emptyState(), migrationMissing: false, client: null };

  const { state, migrationMissing } = await loadStateFromSupabase(client, logger);
  logger.info(`estado leido de Supabase: ${state.stores.length} tienda(s), ${state.items.length} item(s)`);

  return { state, migrationMissing, client };
};

const overridesFrom = (flags: ParsedArgs['flags']): ConfigOverrides => {
  const provider = flagString(flags, 'provider');
  const overrides: ConfigOverrides = {};

  if (provider === 'file' || provider === 'serper' || provider === 'brave' || provider === 'none') {
    overrides.provider = provider;
  }

  const maxNewDomains = flagNumber(flags, 'max-new');
  if (maxNewDomains !== undefined) overrides.maxNewDomains = maxNewDomains;

  const minDelayMs = flagNumber(flags, 'delay');
  if (minDelayMs !== undefined) overrides.minDelayMs = minDelayMs;

  const maxConcurrent = flagNumber(flags, 'concurrency');
  if (maxConcurrent !== undefined) overrides.maxConcurrent = maxConcurrent;

  const maxPages = flagNumber(flags, 'max-pages');
  if (maxPages !== undefined) overrides.maxPagesPerSite = maxPages;

  const output = flagString(flags, 'out');
  if (output !== undefined) overrides.output = path.resolve(output);

  const seeds = flagString(flags, 'seeds');
  if (seeds !== undefined) overrides.seeds = path.resolve(seeds);

  const candidates = flagString(flags, 'candidates');
  if (candidates !== undefined) overrides.candidates = path.resolve(candidates);

  return overrides;
};

const MODES: Record<string, SurveyMode> = { run: 'full', update: 'update', discover: 'discover' };

const runSurvey = async (command: string, flags: ParsedArgs['flags']): Promise<number> => {
  const logger = createLogger((flagString(flags, 'log') as LogLevel | undefined) ?? 'info');
  const config = buildConfig(overridesFrom(flags));
  const mode = MODES[command] ?? 'full';

  const run = createRunContext({ mode, logger });

  logger.step(`Relevamiento ${mode} · corrida ${run.runId}`);

  const { state, migrationMissing } = await resolveState(flags, logger);

  if (migrationMissing) {
    logger.warn('el SQL generado va a fallar hasta que se aplique la migracion 202609080001_supplier_survey.sql');
  }

  const [seeds, queries] = await Promise.all([loadSeeds(config), loadQueries(config)]);

  if (mode !== 'discover' && seeds.length === 0 && state.stores.every((store) => store.website === null)) {
    logger.warn(
      'no hay sitios que relevar: ni semillas en seeds/sources.json ni tiendas con web cargada en la base.',
    );
  }

  const plan = await runPipeline({ run, config, state, seeds, queries, mode, logger, force: flagBoolean(flags, 'force') });

  const report = buildReport(plan);
  const sql = renderSyncSql(plan, {
    sourceName: config.sourceName,
    actorEmail: process.env.SURVEY_DB_ACTOR_EMAIL ?? null,
  });

  await mkdir(config.paths.output, { recursive: true });

  const stamp = plan.finishedAt.slice(0, 10);
  const base = path.join(config.paths.output, `${stamp}-${plan.runId.slice(0, 8)}`);

  await Promise.all([
    writeFile(`${base}.report.json`, JSON.stringify(report, null, 2), 'utf8'),
    writeFile(`${base}.report.md`, renderMarkdown(report), 'utf8'),
    writeFile(`${base}.sync.sql`, sql, 'utf8'),
    writeFile(path.join(config.paths.output, 'latest.report.json'), JSON.stringify(report, null, 2), 'utf8'),
    writeFile(path.join(config.paths.output, 'latest.report.md'), renderMarkdown(report), 'utf8'),
    writeFile(path.join(config.paths.output, 'latest.sync.sql'), sql, 'utf8'),
  ]);

  logger.step('Resultado');
  console.log(renderMarkdown(report));

  logger.step('Archivos');
  logger.info(`SQL:      ${base}.sync.sql`);
  logger.info(`Reporte:  ${base}.report.md`);

  if (report.revisionManual.length > 0) {
    logger.info(`\n${report.revisionManual.length} registro(s) necesitan revision manual.`);
  }

  logger.info('\nEl SQL no se aplico. Revisalo y corrilo en el SQL editor de Supabase.');

  // Codigo 1 si todos los sitios fallaron: en CI eso tiene que romper.
  const { total, fallidos } = report.summary.sitios;
  return total > 0 && fallidos === total ? 1 : 0;
};

/** Resumen legible del import, para el reporte y para la consola. */
const renderImportReport = (plan: ImportPlan, sourceFile: string): string => {
  const lines = [
    `# Carga de planilla — ${plan.surveyDate.slice(0, 10)}`,
    '',
    `Planilla \`${sourceFile}\` · carga \`${plan.runId}\``,
    '',
    '| Tiendas nuevas | Tiendas actualizadas | A revisar | Materiales | Precios |',
    '|---|---|---|---|---|',
    `| ${plan.storeInserts.length} | ${plan.storeUpdates.length} | ${plan.candidates.length} | ${plan.itemInserts.length} | ${plan.priceInserts.length} |`,
    '',
  ];

  if (plan.storeInserts.length > 0) {
    lines.push('## Tiendas que entran al catalogo', '', '| Tienda | Dominio | Telefono | Direccion |', '|---|---|---|---|');
    for (const store of plan.storeInserts) {
      lines.push(`| ${store.name} | ${store.canonicalDomain} | ${store.phone ?? '—'} | ${store.address ?? '—'} |`);
    }
    lines.push('');
  }

  if (plan.storeUpdates.length > 0) {
    lines.push('## Tiendas que ya estaban', '', '| Tienda | Campo | Nuevo valor |', '|---|---|---|');
    for (const update of plan.storeUpdates) {
      for (const [field, value] of Object.entries(update.changes)) {
        lines.push(`| ${update.storeName} | ${field} | ${value ?? '(vacio)'} |`);
      }
    }
    lines.push('');
  }

  if (plan.conflicts.length > 0) {
    lines.push('## Conflictos (no se escriben)', '', '| Tienda | Campo | En la base | En la planilla |', '|---|---|---|---|');
    for (const entry of plan.conflicts) {
      for (const conflict of entry.conflicts) {
        lines.push(
          `| ${entry.storeName} | ${conflict.fieldName} | ${conflict.current ?? '(vacio)'} | ${conflict.incoming ?? '(vacio)'} |`,
        );
      }
    }
    lines.push('');
  }

  if (plan.candidates.length > 0) {
    lines.push('## Candidatos a revisar', '', '| Tienda | Dominio | Motivo |', '|---|---|---|');
    for (const candidate of plan.candidates) {
      lines.push(`| ${candidate.company.name} | ${candidate.company.canonicalDomain} | ${candidate.matchReason} |`);
    }
    lines.push('');
  }

  if (plan.reusedItems.length > 0) {
    lines.push('## Materiales reusados del catalogo', '', '| De la planilla | Se cargo sobre | Confianza |', '|---|---|---|');
    for (const reused of plan.reusedItems) {
      lines.push(`| ${reused.importedName} | ${reused.existing} | ${reused.confidence}% |`);
    }
    lines.push('');
  }

  if (plan.possibleItemDuplicates.length > 0) {
    lines.push(
      '## Posibles materiales duplicados',
      '',
      'Se crean igual, con el nombre de la planilla. Si son el mismo material,',
      'archiva el que sobre desde la app.',
      '',
      '| De la planilla | Unidad | Se parece a | Confianza |',
      '|---|---|---|---|',
    );
    for (const duplicate of plan.possibleItemDuplicates) {
      lines.push(`| ${duplicate.importedName} | ${duplicate.unit} | ${duplicate.existing} | ${duplicate.confidence}% |`);
    }
    lines.push('');
  }

  if (plan.skippedPrices.length > 0) {
    lines.push('## Precios que no se cargan', '', '| Item | Tienda | Motivo |', '|---|---|---|');
    for (const skipped of plan.skippedPrices) {
      lines.push(`| ${skipped.price.itemName} | ${skipped.price.storeName} | ${skipped.reason} |`);
    }
    lines.push('');
  }

  if (plan.warnings.length > 0) {
    lines.push('## Avisos', '', ...plan.warnings.map((warning) => `- ${warning}`), '');
  }

  return lines.join('\n');
};

const runImport = async (flags: ParsedArgs['flags']): Promise<number> => {
  const logger = createLogger((flagString(flags, 'log') as LogLevel | undefined) ?? 'info');
  const config = buildConfig(overridesFrom(flags));

  const filePath = flagString(flags, 'file');
  if (!filePath) {
    logger.error('falta --file con la ruta de la planilla .xlsx');
    return 1;
  }

  const resolved = path.resolve(filePath);
  logger.step(`Leyendo ${path.basename(resolved)}`);

  let workbook;
  try {
    workbook = readAmbaWorkbook(readWorkbook(await readFile(resolved)));
  } catch (error) {
    logger.error(`no pude leer la planilla: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  logger.info(
    `${workbook.companies.length} empresa(s), ${workbook.prices.length} precio(s), relevado ${workbook.surveyDate?.slice(0, 10) ?? 'sin fecha'}`,
  );

  const { state, migrationMissing } = await resolveState(flags, logger);
  if (migrationMissing) {
    logger.warn('el SQL generado va a fallar hasta que se aplique la migracion 202609080001_supplier_survey.sql');
  }

  const plan = buildImportPlan(workbook, state, path.basename(resolved));

  const sql = renderImportSql(plan, {
    sourceName: 'relevamiento_amba',
    actorEmail: process.env.SURVEY_DB_ACTOR_EMAIL ?? null,
    sourceFile: path.basename(resolved),
  });

  const report = renderImportReport(plan, path.basename(resolved));

  await mkdir(config.paths.output, { recursive: true });
  const base = path.join(config.paths.output, `import-${plan.surveyDate.slice(0, 10)}`);

  await Promise.all([
    writeFile(`${base}.sql`, sql, 'utf8'),
    writeFile(`${base}.report.md`, report, 'utf8'),
    writeFile(path.join(config.paths.output, 'latest.import.sql'), sql, 'utf8'),
    writeFile(path.join(config.paths.output, 'latest.import.report.md'), report, 'utf8'),
  ]);

  console.log(`\n${report}`);

  logger.step('Archivos');
  logger.info(`SQL:      ${base}.sql`);
  logger.info(`Reporte:  ${base}.report.md`);
  logger.info('\nNo se aplico nada. Revisa el SQL y corrilo en el SQL editor de Supabase.');

  return 0;
};

const runSnapshot = async (flags: ParsedArgs['flags']): Promise<number> => {
  const logger = createLogger((flagString(flags, 'log') as LogLevel | undefined) ?? 'info');
  const config = buildConfig(overridesFrom(flags));

  const credentials = readSupabaseCredentials();
  if (!credentials) {
    logger.error('faltan credenciales: SURVEY_SUPABASE_EMAIL y SURVEY_SUPABASE_PASSWORD (o las de keep-alive).');
    return 1;
  }

  const client = await connectSupabase(credentials, logger);
  if (!client) return 1;

  const { state } = await loadStateFromSupabase(client, logger);
  const target = flagString(flags, 'out') ?? path.join(config.paths.output, 'state.json');

  await saveStateSnapshot(state, target);
  logger.info(`snapshot guardado en ${target}: ${state.stores.length} tienda(s), ${state.items.length} item(s)`);

  return 0;
};

const runReport = async (flags: ParsedArgs['flags']): Promise<number> => {
  const config = buildConfig(overridesFrom(flags));
  const target = path.join(config.paths.output, 'latest.report.md');

  try {
    console.log(await readFile(target, 'utf8'));
    return 0;
  } catch {
    console.error(`No hay reporte en ${target}. Corre el relevamiento primero.`);
    return 1;
  }
};

const usage = (): void => {
  console.log(
    [
      'Relevamiento de proveedores de aire acondicionado',
      '',
      'Uso: node tools/supplier-survey/cli.ts <comando> [opciones]',
      '',
      'Comandos:',
      '  run        Relevamiento completo: sitios conocidos + discovery',
      '  update     Solo actualiza los sitios que ya conocemos',
      '  discover   Solo busca empresas nuevas',
      '  import     Carga una planilla .xlsx relevada a mano (--file)',
      '  snapshot   Baja el estado de la base a un archivo, para correr offline',
      '  report     Muestra el ultimo reporte generado',
      '',
      'Opciones:',
      '  --file <planilla.xlsx>               Planilla a importar (comando import)',
      '  --provider <file|serper|brave|none>  Buscador del discovery (default: file)',
      '  --state <archivo>                    Usa un snapshot en vez de Supabase',
      '  --out <directorio>                   Donde dejar SQL y reporte',
      '  --seeds <archivo>                    Otro seeds/sources.json',
      '  --candidates <archivo>               Otro seeds/candidates.json',
      '  --max-new <n>                        Tope de dominios nuevos (default: 40)',
      '  --max-pages <n>                      Paginas por sitio (default: 6)',
      '  --delay <ms>                         Espera minima por host (default: 2000)',
      '  --concurrency <n>                    Pedidos en paralelo (default: 3)',
      '  --force                              Ignora la cache y vuelve a bajar todo',
      '  --log <silent|error|warn|info|debug>',
      '',
      'Variables de entorno:',
      '  EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY',
      '  SURVEY_SUPABASE_EMAIL / SURVEY_SUPABASE_PASSWORD   (o las de KEEPALIVE_*)',
      '  SURVEY_DB_ACTOR_EMAIL     Usuario al que se atribuye el relevamiento',
      '  SERPER_API_KEY / BRAVE_SEARCH_API_KEY              (opcionales)',
    ].join('\n'),
  );
};

const main = async (): Promise<number> => {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (flags.has('help') || command === 'help') {
    usage();
    return 0;
  }

  switch (command) {
    case 'run':
    case 'update':
    case 'discover':
      return runSurvey(command, flags);
    case 'import':
      return runImport(flags);
    case 'snapshot':
      return runSnapshot(flags);
    case 'report':
      return runReport(flags);
    default:
      console.error(`Comando desconocido: ${command}\n`);
      usage();
      return 1;
  }
};

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error('El relevamiento fallo:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
