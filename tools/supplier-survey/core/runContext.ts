import { randomUUID } from 'node:crypto';

import type { Logger } from './logger.ts';

/**
 * Identidad y reloj de una corrida.
 *
 * `scrapedAt` es uno solo para toda la corrida a proposito: si cada sitio usara
 * su propio `now()`, dos corridas del mismo sitio nunca darian huellas
 * comparables y el reporte no permitiria agrupar por ejecucion.
 */
export interface RunContext {
  runId: string;
  startedAt: string;
  scrapedAt: string;
  mode: string;
  logger: Logger;
  /** Inyectable para tests deterministas. */
  now: () => Date;
}

interface CreateRunContextOptions {
  mode: string;
  logger: Logger;
  runId?: string;
  now?: () => Date;
}

export const createRunContext = ({ mode, logger, runId, now }: CreateRunContextOptions): RunContext => {
  const clock = now ?? (() => new Date());
  const startedAt = clock().toISOString();

  return {
    runId: runId ?? randomUUID(),
    startedAt,
    scrapedAt: startedAt,
    mode,
    logger,
    now: clock,
  };
};
