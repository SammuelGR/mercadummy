import { Inject, Injectable } from '@nestjs/common';
import type { Model, QueryFilter } from 'mongoose';
import { normalizeSearchText } from '../../../database/mongodb/schemas/product-view.schema.js';
import type { ProductView } from '../../../database/mongodb/schemas/product-view.schema.js';
import { PRODUCT_VIEW_MODEL } from '../../../database/mongodb/view-models.module.js';
import type { ProductCursor } from '../../util/product-cursor.js';
import type { ProductListView } from '../../mappers/product-responses.mapper.js';

export interface CatalogCriteria {
  search?: string;
  categorySlug?: string;
  inStockOnly: boolean;
  after?: ProductCursor;
}

const listProjection = { titleSearch: 0, description: 0, images: 0, specifications: 0 } as const;

/** Reads the `products` view. Inactive products stay in the view and are hidden here. */
@Injectable()
export class ProductsMongoRepository {
  constructor(@Inject(PRODUCT_VIEW_MODEL) private readonly products: Model<ProductView>) {}

  /**
   * Active products in catalog order (`createdAt`, then `_id`), after the cursor when there is one.
   * Served by the `catalog` and `catalog_by_category` indexes.
   */
  findCatalogPage(criteria: CatalogCriteria, limit: number): Promise<ProductListView[]> {
    const filter: QueryFilter<ProductView> = { isActive: true };

    if (criteria.categorySlug !== undefined) {
      filter['category.slug'] = criteria.categorySlug;
    }
    if (criteria.inStockOnly) {
      // Includes Low Stock.
      filter.stock = { $gt: 0 };
    }
    if (criteria.search !== undefined) {
      filter.titleSearch = { $regex: escapeRegex(normalizeSearchText(criteria.search)) };
    }
    if (criteria.after !== undefined) {
      const { createdAt, id } = criteria.after;
      filter.$or = [{ createdAt: { $gt: createdAt } }, { createdAt, _id: { $gt: id } }];
    }

    return this.products
      .find(filter, listProjection)
      .sort({ createdAt: 1, _id: 1 })
      .limit(limit)
      .lean<ProductListView[]>()
      .exec();
  }

  findActiveById(id: string): Promise<ProductView | null> {
    return this.products.findOne({ _id: id, isActive: true }).lean<ProductView>().exec();
  }
}

/** The search term is matched as a literal substring, never as a pattern. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
