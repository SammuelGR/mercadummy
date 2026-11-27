import { HttpStatus } from '@nestjs/common';
import { Query, QueryHandler } from '@nestjs/cqrs';
import type { IQueryHandler } from '@nestjs/cqrs';
import { isUUID } from 'class-validator';
import { ApiException } from '../../common/api-exception.js';
import type { ProductDetailResponse } from '../dto/catalog.dto.js';
import { toProductDetail } from '../mappers/product-responses.mapper.js';
import { ProductsMongoRepository } from '../repositories/mongo/products-mongodb.repository.js';

/** Product detail. A missing, inactive or malformed id gets the same `404`. */
export class GetProductQuery extends Query<ProductDetailResponse> {
  constructor(readonly id: string) {
    super();
  }
}

@QueryHandler(GetProductQuery)
export class GetProductHandler implements IQueryHandler<GetProductQuery> {
  constructor(private readonly products: ProductsMongoRepository) {}

  async execute(query: GetProductQuery): Promise<ProductDetailResponse> {
    const product = isUUID(query.id) ? await this.products.findActiveById(query.id) : null;

    if (product === null) {
      throw new ApiException(HttpStatus.NOT_FOUND, { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' });
    }

    return toProductDetail(product);
  }
}
