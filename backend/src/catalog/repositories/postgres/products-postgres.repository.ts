import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../database/postgres/generated/client.js';

export interface NewProduct {
  externalId: number | null;
  categoryId: string;
  title: string;
  price: number;
  discountPercentage: number;
  stock: number;
  thumbnail: string;
  details: Prisma.InputJsonObject;
}

export interface CreatedProduct {
  id: string;
  externalId: number | null;
}

/** Methods receive the client to use, so handlers can run them inside their own transaction. */
@Injectable()
export class ProductsPostgresRepository {
  /** Creates an active product; a repeated `externalId` raises a unique constraint violation. */
  create(db: Prisma.TransactionClient, product: NewProduct): Promise<CreatedProduct> {
    return db.product.create({ data: product, select: { id: true, externalId: true } });
  }

  async findIdByExternalId(db: Prisma.TransactionClient, externalId: number): Promise<string | null> {
    const product = await db.product.findUnique({ where: { externalId }, select: { id: true } });
    return product?.id ?? null;
  }

  /** SKU uniqueness is not enforced by the database; this lookup scans `details`. */
  async isSkuInUse(db: Prisma.TransactionClient, sku: string): Promise<boolean> {
    const rows = await db.$queryRaw<{ in_use: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM products WHERE details ->> 'sku' = ${sku}) AS in_use
    `;
    return rows.at(0)?.in_use === true;
  }
}
