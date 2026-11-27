import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../database/postgres/generated/client.js';

export interface NewCategory {
  slug: string;
  name: string;
}

export interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
}

/** Methods receive the client to use, so handlers can run them inside their own transaction. */
@Injectable()
export class CategoriesPostgresRepository {
  /** Creates the category; a repeated `slug` raises a unique constraint violation. */
  create(db: Prisma.TransactionClient, category: NewCategory): Promise<CategoryRecord> {
    return db.category.create({ data: category, select: { id: true, slug: true, name: true } });
  }

  async findIdBySlug(db: Prisma.TransactionClient, slug: string): Promise<string | null> {
    const category = await db.category.findUnique({ where: { slug }, select: { id: true } });
    return category?.id ?? null;
  }

  async exists(db: Prisma.TransactionClient, id: string): Promise<boolean> {
    const category = await db.category.findUnique({ where: { id }, select: { id: true } });
    return category !== null;
  }
}
