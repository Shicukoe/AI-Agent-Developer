import { childLogger } from './logger.js';

const log = childLogger('retry');

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; label?: string } = {},
): Promise<T> {
  const { attempts = 3, baseDelayMs = 1000, label = 'operation' } = opts;
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        const delay = baseDelayMs * 2 ** (i - 1);
        log.warn({ attempt: i, delay, label }, 'Retrying after error');
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}
