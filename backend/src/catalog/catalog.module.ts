import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ViewModelsModule } from '../database/mongodb/view-models.module.js';
import { PostgresModule } from '../database/postgres/postgres.module.js';
import { CatalogAdminController } from './controllers/catalog-admin.controller.js';
import { CatalogController } from './controllers/catalog.controller.js';
import { CreateCategoryHandler } from './commands/create-category.js';
import { CreateProductHandler } from './commands/create-product.js';
import { GetProductHandler } from './queries/get-product.js';
import { ListCategoriesHandler } from './queries/list-categories.js';
import { ListProductsHandler } from './queries/list-products.js';
import { CategoriesMongoRepository } from './repositories/mongo/categories-mongodb.repository.js';
import { CategoriesPostgresRepository } from './repositories/postgres/categories-postgres.repository.js';
import { ProductsMongoRepository } from './repositories/mongo/products-mongodb.repository.js';
import { ProductsPostgresRepository } from './repositories/postgres/products-postgres.repository.js';

@Module({
  imports: [PostgresModule, ViewModelsModule, AuthModule],
  controllers: [CatalogController, CatalogAdminController],
  providers: [
    CreateCategoryHandler,
    CreateProductHandler,
    ListCategoriesHandler,
    ListProductsHandler,
    GetProductHandler,
    CategoriesPostgresRepository,
    ProductsPostgresRepository,
    CategoriesMongoRepository,
    ProductsMongoRepository,
  ],
})
export class CatalogModule {}
