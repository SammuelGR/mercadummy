import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { DEFAULT_PRODUCTS_LIMIT, ListProductsQueryDto } from '../dto/catalog.dto.js';
import type { CategoryListResponse, ProductDetailResponse, ProductListResponse } from '../dto/catalog.dto.js';
import { GetProductQuery } from '../queries/get-product.js';
import { ListCategoriesQuery } from '../queries/list-categories.js';
import { ListProductsQuery } from '../queries/list-products.js';

/** Public catalog routes, served from the MongoDB views. */
@Controller()
export class CatalogController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('categories')
  listCategories(): Promise<CategoryListResponse> {
    return this.queryBus.execute(new ListCategoriesQuery());
  }

  @Get('products')
  listProducts(@Query() query: ListProductsQueryDto): Promise<ProductListResponse> {
    return this.queryBus.execute(
      new ListProductsQuery({
        search: query.search,
        categorySlug: query.category,
        inStockOnly: query.inStock ?? false,
        cursor: query.cursor,
        limit: query.limit ?? DEFAULT_PRODUCTS_LIMIT,
      }),
    );
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string): Promise<ProductDetailResponse> {
    return this.queryBus.execute(new GetProductQuery(id));
  }
}
