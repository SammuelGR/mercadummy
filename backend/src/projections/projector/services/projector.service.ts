import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../database/postgres/generated/client.js';
import type { OutboxAggregateType } from '../../../database/postgres/outbox.js';
import { ProjectionsPostgresRepository } from '../repositories/postgres/projections-postgres.repository.js';
import { CategoryViewsMongoRepository } from '../repositories/mongo/categories-mongodb.repository.js';
import { OrderViewsMongoRepository } from '../repositories/mongo/orders-mongodb.repository.js';
import { ProductViewsMongoRepository } from '../repositories/mongo/products-mongodb.repository.js';
import { toCategoryView, toOrderView, toProductView } from '../views.mapper.js';
import type { CategoryRow, OrderRow, ProductRow } from '../views.mapper.js';

/** Current PostgreSQL state of one aggregate; `row` is undefined when the record no longer exists. */
export type LoadedAggregate =
  | { aggregateType: 'CATEGORY'; id: string; row: CategoryRow | undefined }
  | { aggregateType: 'PRODUCT'; id: string; row: ProductRow | undefined }
  | { aggregateType: 'ORDER'; id: string; row: OrderRow | undefined };

/**
 * Projects aggregates by rereading their current state, never by applying event content,
 * so projecting the same aggregate again is safe.
 */
@Injectable()
export class ProjectorService {
  constructor(
    private readonly postgres: ProjectionsPostgresRepository,
    private readonly categoryViews: CategoryViewsMongoRepository,
    private readonly productViews: ProductViewsMongoRepository,
    private readonly orderViews: OrderViewsMongoRepository,
  ) {}

  /** Creates the indexes of every view, as declared in their schemas. */
  async createIndexes(): Promise<void> {
    await this.categoryViews.createIndexes();
    await this.productViews.createIndexes();
    await this.orderViews.createIndexes();
  }

  /** Reads PostgreSQL only; kept apart from `apply` so callers can tell PostgreSQL failures from view failures. */
  async load(db: Prisma.TransactionClient, aggregateType: OutboxAggregateType, id: string): Promise<LoadedAggregate> {
    switch (aggregateType) {
      case 'CATEGORY':
        return { aggregateType, id, row: (await this.postgres.loadCategories(db, [id])).at(0) };
      case 'PRODUCT':
        return { aggregateType, id, row: (await this.postgres.loadProducts(db, [id])).at(0) };
      case 'ORDER':
        return { aggregateType, id, row: (await this.postgres.loadOrders(db, [id])).at(0) };
    }
  }

  /** Transforms the loaded state and replaces the view document, or deletes it when the record is gone. */
  async apply(loaded: LoadedAggregate): Promise<void> {
    switch (loaded.aggregateType) {
      case 'CATEGORY':
        await (loaded.row === undefined
          ? this.categoryViews.delete(loaded.id)
          : this.categoryViews.save(toCategoryView(loaded.row)));
        return;
      case 'PRODUCT':
        await (loaded.row === undefined
          ? this.productViews.delete(loaded.id)
          : this.productViews.save(toProductView(loaded.row)));
        return;
      case 'ORDER':
        await (loaded.row === undefined
          ? this.orderViews.delete(loaded.id)
          : this.orderViews.save(toOrderView(loaded.row)));
        return;
    }
  }
}
