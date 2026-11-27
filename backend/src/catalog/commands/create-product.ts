import { HttpStatus } from '@nestjs/common';
import { Command, CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { ApiException } from '../../common/api-exception.js';
import { PrismaClient } from '../../database/postgres/generated/client.js';
import type { Prisma } from '../../database/postgres/generated/client.js';
import { appendOutboxEvent } from '../../database/postgres/outbox.js';
import { isUniqueConstraintViolation } from '../../database/postgres/postgres-errors.js';
import type { CreatedProductResponse } from '../catalog-admin.dto.js';
import { CategoriesPostgresRepository } from '../repositories/categories-postgres.repository.js';
import { ProductsPostgresRepository } from '../repositories/products-postgres.repository.js';
import type { NewProduct } from '../repositories/products-postgres.repository.js';

/** Creates an active product. An existing `externalId` is reported with its id and left unchanged. */
export class CreateProductCommand extends Command<CreatedProductResponse> {
  constructor(readonly product: NewProduct) {
    super();
  }
}

@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly categories: CategoriesPostgresRepository,
    private readonly products: ProductsPostgresRepository,
  ) {}

  async execute({ product }: CreateProductCommand): Promise<CreatedProductResponse> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        // The checking order is part of the contract: a rerun of the migration must see
        // an imported product as existing, not as a repeated SKU.
        if (product.externalId !== null) {
          await this.rejectExistingExternalId(transaction, product.externalId);
        }

        if (!(await this.categories.exists(transaction, product.categoryId))) {
          throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, {
            code: 'CATEGORY_NOT_FOUND',
            message: 'Category not found',
          });
        }

        const sku = product.details.sku;
        if (typeof sku === 'string' && (await this.products.isSkuInUse(transaction, sku))) {
          throw new ApiException(HttpStatus.CONFLICT, { code: 'SKU_ALREADY_IN_USE', message: 'SKU already in use' });
        }

        const created = await this.products.create(transaction, product);
        await appendOutboxEvent(transaction, {
          aggregateType: 'PRODUCT',
          aggregateId: created.id,
          eventType: 'ProductUpserted',
        });
        return created;
      });
    } catch (error) {
      // Only `external_id` can conflict: a concurrent creation committed the same id first.
      if (product.externalId === null || !isUniqueConstraintViolation(error)) {
        throw error;
      }
    }

    await this.rejectExistingExternalId(this.prisma, product.externalId);
    throw new Error(`Product with external id ${String(product.externalId)} conflicted but was not found.`);
  }

  private async rejectExistingExternalId(db: Prisma.TransactionClient, externalId: number): Promise<void> {
    const existingId = await this.products.findIdByExternalId(db, externalId);
    if (existingId !== null) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'PRODUCT_ALREADY_EXISTS',
        message: 'Product already exists',
        existingId,
      });
    }
  }
}
