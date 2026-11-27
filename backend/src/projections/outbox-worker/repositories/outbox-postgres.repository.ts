import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../database/postgres/generated/client.js';
import type { OutboxAggregateType } from '../../../database/postgres/outbox.js';

/** Advisory lock key shared by the worker (shared lock) and the rebuild (exclusive lock). */
export const PROJECTION_LOCK_KEY = 727001;

/** Events with this many failed attempts stay pending until `retry-failed` reactivates them. */
export const MAX_OUTBOX_ATTEMPTS = 10;

export interface PendingOutboxEvent {
  id: bigint;
  aggregateType: OutboxAggregateType;
  aggregateId: string;
}

interface PendingOutboxEventRow {
  id: bigint;
  aggregate_type: OutboxAggregateType;
  aggregate_id: string;
}

/** Queue operations of the worker. Every method runs inside the worker's batch transaction. */
@Injectable()
export class OutboxPostgresRepository {
  /** Returns false while a rebuild holds the exclusive lock. Released when the transaction ends. */
  async tryLockShared(transaction: Prisma.TransactionClient): Promise<boolean> {
    const rows = await transaction.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock_shared(${PROJECTION_LOCK_KEY}::bigint) AS locked
    `;
    return rows.at(0)?.locked === true;
  }

  /** Locks a batch of pending events, skipping those locked by another transaction. */
  async lockPendingBatch(transaction: Prisma.TransactionClient, limit: number): Promise<PendingOutboxEvent[]> {
    const rows = await transaction.$queryRaw<PendingOutboxEventRow[]>`
      SELECT id, aggregate_type, aggregate_id
      FROM outbox_events
      WHERE processed_at IS NULL AND attempts < ${MAX_OUTBOX_ATTEMPTS}
      ORDER BY id
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    return rows.map((row) => ({ id: row.id, aggregateType: row.aggregate_type, aggregateId: row.aggregate_id }));
  }

  async markProcessed(transaction: Prisma.TransactionClient, id: bigint): Promise<void> {
    await transaction.$executeRaw`
      UPDATE outbox_events SET processed_at = now(), last_error = NULL WHERE id = ${id}
    `;
  }

  async markFailed(transaction: Prisma.TransactionClient, id: bigint, lastError: string): Promise<void> {
    await transaction.$executeRaw`
      UPDATE outbox_events SET attempts = attempts + 1, last_error = ${lastError} WHERE id = ${id}
    `;
  }
}
