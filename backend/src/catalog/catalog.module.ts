import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostgresModule } from '../database/postgres/postgres.module.js';
import { CatalogAdminController } from './catalog-admin.controller.js';
import { CreateCategoryHandler } from './commands/create-category.js';
import { CreateProductHandler } from './commands/create-product.js';
import { CategoriesPostgresRepository } from './repositories/categories-postgres.repository.js';
import { ProductsPostgresRepository } from './repositories/products-postgres.repository.js';

@Module({
  imports: [PostgresModule, AuthModule],
  controllers: [CatalogAdminController],
  providers: [CreateCategoryHandler, CreateProductHandler, CategoriesPostgresRepository, ProductsPostgresRepository],
})
export class CatalogModule {}
