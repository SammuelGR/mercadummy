import { Query, QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import type { CategoryListResponse } from '../dto/catalog.dto.js';
import { toCategoryResponse } from '../mappers/product-responses.mapper.js';
import { CategoriesMongoRepository } from '../repositories/mongo/categories-mongodb.repository.js';

/** Lists every category, sorted by name, for the catalog filter. */
export class ListCategoriesQuery extends Query<CategoryListResponse> {}

@QueryHandler(ListCategoriesQuery)
export class ListCategoriesHandler implements IQueryHandler<ListCategoriesQuery> {
  constructor(private readonly categories: CategoriesMongoRepository) {}

  async execute(): Promise<CategoryListResponse> {
    const categories = await this.categories.findAllSortedByName();
    return { items: categories.map(toCategoryResponse) };
  }
}
