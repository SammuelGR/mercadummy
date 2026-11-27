import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from './auth/auth.module.js';
import { CommonModule } from './common/common.module.js';
import { MongoModule } from './database/mongodb/mongo.module.js';
import { PostgresModule } from './database/postgres/postgres.module.js';
import { RedisModule } from './database/redis/redis.module.js';

@Module({ imports: [CqrsModule.forRoot(), CommonModule, PostgresModule, MongoModule, RedisModule, AuthModule] })
export class AppModule {}
