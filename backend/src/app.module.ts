import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongoModule } from './database/mongodb/mongo.module.js';
import { PostgresModule } from './database/postgres/postgres.module.js';
import { RedisModule } from './database/redis/redis.module.js';

@Module({ imports: [CqrsModule.forRoot(), PostgresModule, MongoModule, RedisModule] })
export class AppModule {}
