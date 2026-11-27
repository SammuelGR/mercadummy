import { Inject, Injectable, Logger } from '@nestjs/common';
import type { BeforeApplicationShutdown, OnApplicationBootstrap } from '@nestjs/common';
import { STATES as connectionStates } from 'mongoose';
import type { Connection } from 'mongoose';
import { isMongoUnavailableError } from '../../database/mongodb/mongo-errors.js';
import { MONGODB_CONNECTION } from '../../database/mongodb/mongo.module.js';
import { Prisma, PrismaClient } from '../../database/postgres/generated/client.js';
import { ProjectorService } from '../projector/projector.service.js';
import { OutboxPostgresRepository } from './repositories/outbox-postgres.repository.js';
import type { PendingOutboxEvent } from './repositories/outbox-postgres.repository.js';
import { WORKER_CONFIG } from './worker-config.js';
import type { WorkerConfig } from './worker-config.js';

/** Upper bound for one batch transaction, which includes the MongoDB writes of every event in it. */
const batchTransactionTimeoutMs = 60_000;
const maxLastErrorLength = 2000;

type CycleResult = 'locked' | 'idle' | 'more-pending' | 'had-failures';

/**
 * Consumes `outbox_events` and updates the MongoDB views. The design assumes a single worker process.
 * Each cycle runs in one READ COMMITTED transaction: shared lock, pending batch, project, mark the results.
 */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(OutboxWorker.name);
  private stopping = false;
  private indexesCreated = false;
  private running?: Promise<void>;
  private sleepTimer?: ReturnType<typeof setTimeout>;
  private wakeUp?: () => void;

  constructor(
    private readonly prisma: PrismaClient,
    @Inject(MONGODB_CONNECTION) private readonly mongoConnection: Connection,
    private readonly outbox: OutboxPostgresRepository,
    private readonly projector: ProjectorService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {}

  onApplicationBootstrap(): void {
    this.running = this.run();
  }

  /** Stops polling and waits for the current batch before the database connections close. */
  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    clearTimeout(this.sleepTimer);
    this.wakeUp?.();
    await this.running;
  }

  private async run(): Promise<void> {
    this.logger.log('Outbox worker started.');

    while (!this.stopping) {
      await this.sleep(await this.runCycleSafely());
    }

    this.logger.log('Outbox worker stopped.');
  }

  /** Runs one cycle and returns how long to wait before the next one. */
  private async runCycleSafely(): Promise<number> {
    // Without MongoDB, skip the cycle instead of spending the attempts of every pending event.
    if (this.mongoConnection.readyState !== connectionStates.connected) {
      return this.config.retryDelayMs;
    }

    try {
      if (!this.indexesCreated) {
        await this.projector.createIndexes();
        this.indexesCreated = true;
        this.logger.log('MongoDB view indexes are in place.');
      }

      switch (await this.runCycle()) {
        case 'more-pending':
          return 0;
        case 'had-failures':
          return this.config.retryDelayMs;
        case 'locked':
        case 'idle':
          return this.config.pollIntervalMs;
      }
    } catch (error) {
      // The batch transaction was rolled back; events already written to MongoDB are reprocessed safely.
      this.logger.warn(`Outbox cycle failed and will be retried: ${describe(error)}`);
      return this.config.retryDelayMs;
    }
  }

  private runCycle(): Promise<CycleResult> {
    return this.prisma.$transaction(
      async (transaction) => {
        if (!(await this.outbox.tryLockShared(transaction))) {
          return 'locked';
        }

        const events = await this.outbox.lockPendingBatch(transaction, this.config.batchSize);
        let failures = 0;
        for (const event of events) {
          if (!(await this.processEvent(transaction, event))) {
            failures++;
          }
        }

        if (events.length > 0) {
          this.logger.log(`Processed ${String(events.length - failures)} of ${String(events.length)} outbox events.`);
        }

        if (failures > 0) {
          return 'had-failures';
        }
        return events.length === this.config.batchSize ? 'more-pending' : 'idle';
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: batchTransactionTimeoutMs },
    );
  }

  /**
   * Projects one event and records the result. PostgreSQL errors and MongoDB connection failures propagate
   * and abort the batch; any other error counts as a failed attempt of this event.
   */
  private async processEvent(transaction: Prisma.TransactionClient, event: PendingOutboxEvent): Promise<boolean> {
    const loaded = await this.projector.load(transaction, event.aggregateType, event.aggregateId);

    try {
      await this.projector.apply(loaded);
    } catch (error) {
      if (isMongoUnavailableError(error)) {
        throw error;
      }

      const message = describe(error);
      this.logger.warn(
        `Outbox event ${String(event.id)} (${event.aggregateType} ${event.aggregateId}) failed: ${message}`,
      );
      await this.outbox.markFailed(transaction, event.id, message.slice(0, maxLastErrorLength));
      return false;
    }

    await this.outbox.markProcessed(transaction, event.id);
    return true;
  }

  private sleep(milliseconds: number): Promise<void> {
    if (this.stopping || milliseconds === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.wakeUp = resolve;
      this.sleepTimer = setTimeout(resolve, milliseconds);
    });
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
