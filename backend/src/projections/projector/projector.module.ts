import { Module } from '@nestjs/common';
import { PostgresModule } from '../../database/postgres/postgres.module.js';
import { ViewModelsModule } from '../../database/mongodb/view-models.module.js';
import { ProjectorService } from './projector.service.js';
import { ProjectionsPostgresRepository } from './repositories/postgres/projections-postgres.repository.js';
import { CategoryViewsMongoRepository } from './repositories/mongo/category-views-mongodb.repository.js';
import { ProductViewsMongoRepository } from './repositories/mongo/product-views-mongodb.repository.js';
import { OrderViewsMongoRepository } from './repositories/mongo/order-views-mongodb.repository.js';

/** Projection logic shared by the outbox worker and the rebuild. */
@Module({
  imports: [PostgresModule, ViewModelsModule],
  providers: [
    ProjectorService,
    ProjectionsPostgresRepository,
    CategoryViewsMongoRepository,
    ProductViewsMongoRepository,
    OrderViewsMongoRepository,
  ],
  exports: [
    ProjectorService,
    ProjectionsPostgresRepository,
    CategoryViewsMongoRepository,
    ProductViewsMongoRepository,
    OrderViewsMongoRepository,
  ],
})
export class ProjectorModule {}
