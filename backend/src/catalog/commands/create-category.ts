import { HttpStatus } from '@nestjs/common';
import { Command, CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { ApiException } from '../../common/api-exception.js';
import { PrismaClient } from '../../database/postgres/generated/client.js';
import { appendOutboxEvent } from '../../database/postgres/outbox.js';
import { isUniqueConstraintViolation } from '../../database/postgres/postgres-errors.js';
import type { CategoryResponse } from '../dto/catalog.dto.js';
import { CategoriesPostgresRepository } from '../repositories/postgres/categories-postgres.repository.js';

/** Creates a category. An existing `slug` is reported with its id and left unchanged. */
export class CreateCategoryCommand extends Command<CategoryResponse> {
  constructor(
    readonly slug: string,
    readonly name: string,
  ) {
    super();
  }
}

@CommandHandler(CreateCategoryCommand)
export class CreateCategoryHandler implements ICommandHandler<CreateCategoryCommand> {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly categories: CategoriesPostgresRepository,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<CategoryResponse> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const category = await this.categories.create(transaction, { slug: command.slug, name: command.name });
        await appendOutboxEvent(transaction, {
          aggregateType: 'CATEGORY',
          aggregateId: category.id,
          eventType: 'CategoryUpserted',
        });
        return category;
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
    }

    // The transaction was rolled back; categories are never deleted, so the conflicting one still exists.
    const existingId = await this.categories.findIdBySlug(this.prisma, command.slug);
    if (existingId === null) {
      throw new Error(`Category with slug "${command.slug}" conflicted but was not found.`);
    }

    throw new ApiException(HttpStatus.CONFLICT, {
      code: 'CATEGORY_ALREADY_EXISTS',
      message: 'Category already exists',
      existingId,
    });
  }
}
