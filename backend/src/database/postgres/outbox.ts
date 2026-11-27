import type { Prisma } from './generated/client.js';

export type OutboxAggregateType = 'CATEGORY' | 'PRODUCT' | 'ORDER';

export type OutboxEventType =
  'CategoryUpserted' | 'ProductUpserted' | 'ProductStockChanged' | 'OrderPlaced' | 'ReprocessRequested';

export interface OutboxEvent {
  aggregateType: OutboxAggregateType;
  aggregateId: string;
  eventType: OutboxEventType;
}

/**
 * Records an event for the projection worker. Call it with the transaction client that writes the record,
 * so the event is committed together with it.
 */
export async function appendOutboxEvent(transaction: Prisma.TransactionClient, event: OutboxEvent): Promise<void> {
  await transaction.outboxEvent.create({ data: event, select: { id: true } });
}
