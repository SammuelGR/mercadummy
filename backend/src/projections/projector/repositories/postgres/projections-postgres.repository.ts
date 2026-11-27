import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../database/postgres/generated/client.js';
import type { CategoryRow, OrderRow, ProductRow } from '../../views.mapper.js';

/**
 * The `load-*` queries shared by the worker and the rebuild. Each record is loaded with a single statement,
 * so its version and content come from the same moment.
 */
@Injectable()
export class ProjectionsPostgresRepository {
  loadCategories(db: Prisma.TransactionClient, ids: string[]): Promise<CategoryRow[]> {
    return db.$queryRaw<CategoryRow[]>`
      SELECT id, slug, name, version
      FROM categories
      WHERE id = ANY(${ids}::uuid[])
    `;
  }

  loadProducts(db: Prisma.TransactionClient, ids: string[]): Promise<ProductRow[]> {
    return db.$queryRaw<ProductRow[]>`
      SELECT p.id, p.title, p.thumbnail, p.price::text AS price,
             p.discount_percentage::text AS discount_percentage, p.stock,
             p.details, p.is_active, p.created_at, p.version,
             c.id AS category_id, c.slug AS category_slug, c.name AS category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.id = ANY(${ids}::uuid[])
    `;
  }

  loadOrders(db: Prisma.TransactionClient, ids: string[]): Promise<OrderRow[]> {
    return db.$queryRaw<OrderRow[]>`
      SELECT o.id, o.order_number, o.user_id, o.status::text AS status, o.created_at,
             o.total_quantity, o.total::text AS total, o.version,
             json_agg(json_build_object(
                 'productId', i.product_id,
                 'title',     i.title,
                 'thumbnail', i.thumbnail,
                 'price',     i.price::text,
                 'quantity',  i.quantity
             ) ORDER BY i.title, i.product_id) AS items
      FROM orders o
      JOIN order_items i ON i.order_id = o.id
      WHERE o.id = ANY(${ids}::uuid[])
      GROUP BY o.id
    `;
  }
}
