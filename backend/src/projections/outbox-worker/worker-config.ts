import { env } from 'node:process';
import type { FactoryProvider } from '@nestjs/common';

export interface WorkerConfig {
  /** Wait after a cycle that found no more pending events, or while a rebuild holds the lock. */
  pollIntervalMs: number;
  /** Wait after a failed cycle, so a short outage does not exhaust the attempts of the pending events. */
  retryDelayMs: number;
  /** Events locked and processed per transaction. */
  batchSize: number;
}

export const WORKER_CONFIG = Symbol('WORKER_CONFIG');

export const workerConfigProvider: FactoryProvider<WorkerConfig> = {
  provide: WORKER_CONFIG,
  useFactory: () => ({
    pollIntervalMs: readInteger('WORKER_POLL_INTERVAL_MS', 1000, 10, 60_000),
    retryDelayMs: readInteger('WORKER_RETRY_DELAY_MS', 5000, 10, 300_000),
    batchSize: readInteger('WORKER_BATCH_SIZE', 50, 1, 500),
  }),
};

function readInteger(name: string, defaultValue: number, min: number, max: number): number {
  const configuredValue = env[name]?.trim();
  if (!configuredValue) {
    return defaultValue;
  }

  const value = Number(configuredValue);
  if (!/^\d+$/.test(configuredValue) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${String(min)} and ${String(max)}.`);
  }

  return value;
}
