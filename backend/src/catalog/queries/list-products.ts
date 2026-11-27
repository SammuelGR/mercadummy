import { HttpStatus } from '@nestjs/common';
import { Query, QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { ApiException } from '../../common/api-exception.js';
import type { ProductListResponse } from '../dto/catalog.dto.js';
import { decodeProductCursor, encodeProductCursor } from '../util/product-cursor.js';
import type { ProductCursor } from '../util/product-cursor.js';
import { toProductListItem } from '../mappers/product-responses.mapper.js';
import { ProductsMongoRepository } from '../repositories/mongo/products-mongodb.repository.js';

export interface ListProductsParameters {
  search: string | undefined;
  categorySlug: string | undefined;
  inStockOnly: boolean;
  cursor: string | undefined;
  limit: number;
}

/** One page of the catalog ("Load More"), with the cursor of the next page. */
export class ListProductsQuery extends Query<ProductListResponse> {
  constructor(readonly parameters: ListProductsParameters) {
    super();
  }
}

@QueryHandler(ListProductsQuery)
export class ListProductsHandler implements IQueryHandler<ListProductsQuery> {
  constructor(private readonly products: ProductsMongoRepository) {}

  async execute({ parameters }: ListProductsQuery): Promise<ProductListResponse> {
    const after = parameters.cursor === undefined ? undefined : readCursor(parameters.cursor);

    // One extra product tells whether there is a next page.
    const products = await this.products.findCatalogPage(
      {
        search: parameters.search === '' ? undefined : parameters.search,
        categorySlug: parameters.categorySlug,
        inStockOnly: parameters.inStockOnly,
        after,
      },
      parameters.limit + 1,
    );

    const page = products.slice(0, parameters.limit);
    const last = page.at(-1);
    const hasMore = products.length > parameters.limit;

    return {
      items: page.map(toProductListItem),
      nextCursor:
        hasMore && last !== undefined ? encodeProductCursor({ createdAt: last.createdAt, id: last._id }) : null,
    };
  }
}

function readCursor(cursor: string): ProductCursor {
  const decoded = decodeProductCursor(cursor);
  if (decoded === null) {
    throw new ApiException(HttpStatus.BAD_REQUEST, {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      fields: [{ field: 'cursor', message: 'cursor is invalid' }],
    });
  }
  return decoded;
}
