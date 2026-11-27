import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AdminGuard, SessionGuard } from '../../auth/session.guard.js';
import { CreateCategoryDto, CreateProductDto } from '../dto/catalog-admin.dto.js';
import type { CreatedProductResponse } from '../dto/catalog-admin.dto.js';
import type { CategoryResponse } from '../dto/catalog.dto.js';
import { CreateCategoryCommand } from '../commands/create-category.js';
import { CreateProductCommand } from '../commands/create-product.js';
import { toProductDetails } from '../mappers/product-details.mapper.js';

@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class CatalogAdminController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('categories')
  @HttpCode(HttpStatus.CREATED)
  createCategory(@Body() body: CreateCategoryDto): Promise<CategoryResponse> {
    return this.commandBus.execute(new CreateCategoryCommand(body.slug, body.name));
  }

  @Post('products')
  @HttpCode(HttpStatus.CREATED)
  createProduct(@Body() body: CreateProductDto): Promise<CreatedProductResponse> {
    return this.commandBus.execute(
      new CreateProductCommand({
        externalId: body.externalId ?? null,
        categoryId: body.categoryId,
        title: body.title,
        price: body.price,
        discountPercentage: body.discountPercentage,
        stock: body.stock,
        thumbnail: body.thumbnail,
        details: toProductDetails(body.details),
      }),
    );
  }
}
