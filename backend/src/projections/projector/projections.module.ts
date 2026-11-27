import { Module } from '@nestjs/common';
import { PostgresModule } from '../../database/postgres/postgres.module.js';
import { MongoModule } from '../../database/mongodb/mongo.module.js';
import { ProjectorService } from './services/projector.service.js';
import { ProjectionsPostgresRepository } from './repositories/postgres/projections-postgres.repository.js';
import { CategoryViewsMongoRepository } from './repositories/mongo/categories-mongodb.repository.js';
import { ProductViewsMongoRepository } from './repositories/mongo/products-mongodb.repository.js';
import { OrderViewsMongoRepository } from './repositories/mongo/orders-mongodb.repository.js';

/** Projection logic shared by the outbox worker and the rebuild. */
@Module({
  imports: [PostgresModule, MongoModule],
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
export class ProjectionsModule {}
