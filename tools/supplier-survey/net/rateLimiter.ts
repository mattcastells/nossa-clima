/**
 * Rate limiting por host.
 *
 * Por host y no global: dos sitios distintos no tienen por que esperarse entre
 * si, pero a un mismo servidor no le mandamos dos pedidos encimados. Respeta el
 * `Crawl-delay` de robots.txt cuando el sitio lo declara.
 */

export interface RateLimiterOptions {
  /** Milisegundos minimos entre pedidos al mismo host. */
  minDelayMs: number;
  /** Pedidos concurrentes en todo el proceso. */
  maxConcurrent: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class RateLimiter {
  private readonly minDelayMs: number;
  private readonly maxConcurrent: number;
  private readonly sleep: (ms: number) => Promise<void>;

  /** Ultimo momento en que se solto un pedido, por host. */
  private readonly lastRequestAt = new Map<string, number>();
  /** Delay especifico pedido por el robots.txt del host. */
  private readonly hostDelays = new Map<string, number>();
  /** Cola de espera del semaforo de concurrencia. */
  private readonly waiting: Array<() => void> = [];
  private inFlight = 0;

  constructor({ minDelayMs, maxConcurrent, sleep }: RateLimiterOptions) {
    this.minDelayMs = Math.max(0, minDelayMs);
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.sleep = sleep ?? defaultSleep;
  }

  /** Delay declarado por el sitio. Nunca baja del minimo configurado. */
  setHostDelay(host: string, delaySeconds: number): void {
    if (!Number.isFinite(delaySeconds) || delaySeconds <= 0) return;
    this.hostDelays.set(host, Math.max(this.minDelayMs, delaySeconds * 1000));
  }

  delayFor(host: string): number {
    return this.hostDelays.get(host) ?? this.minDelayMs;
  }

  /** Ejecuta `task` respetando concurrencia y espaciado del host. */
  async run<T>(host: string, task: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      const delay = this.delayFor(host);
      const last = this.lastRequestAt.get(host);
      const now = Date.now();

      if (last !== undefined) {
        const elapsed = now - last;
        if (elapsed < delay) await this.sleep(delay - elapsed);
      }

      this.lastRequestAt.set(host, Date.now());
      return await task();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.inFlight < this.maxConcurrent) {
      this.inFlight += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
    this.inFlight += 1;
  }

  private release(): void {
    this.inFlight -= 1;
    const next = this.waiting.shift();
    if (next) next();
  }
}
