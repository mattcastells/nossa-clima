/** Log de consola con niveles. Sin dependencias: esto corre en Node pelado. */

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const ORDER: Record<LogLevel, number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

export interface Logger {
  error: (message: string, ...rest: unknown[]) => void;
  warn: (message: string, ...rest: unknown[]) => void;
  info: (message: string, ...rest: unknown[]) => void;
  debug: (message: string, ...rest: unknown[]) => void;
  step: (message: string) => void;
}

export const createLogger = (level: LogLevel = 'info'): Logger => {
  const enabled = (target: LogLevel): boolean => ORDER[level] >= ORDER[target];

  return {
    error: (message, ...rest) => {
      if (enabled('error')) console.error(`  ✗ ${message}`, ...rest);
    },
    warn: (message, ...rest) => {
      if (enabled('warn')) console.warn(`  ! ${message}`, ...rest);
    },
    info: (message, ...rest) => {
      if (enabled('info')) console.log(`    ${message}`, ...rest);
    },
    debug: (message, ...rest) => {
      if (enabled('debug')) console.log(`    · ${message}`, ...rest);
    },
    step: (message) => {
      if (enabled('info')) console.log(`\n▸ ${message}`);
    },
  };
};

export const silentLogger: Logger = createLogger('silent');
