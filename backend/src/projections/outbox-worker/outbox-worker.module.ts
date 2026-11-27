import { Module } from '@nestjs/common';
import { MongoModule } from '../../database/mongodb/mongo.module.js';
import { PostgresModule } from '../../database/postgres/postgres.module.js';
import { OutboxWorker } from './outbox-worker.service.js';
import { OutboxPostgresRepository } from './repositories/outbox-postgres.repository.js';
import { workerConfigProvider } from './worker-config.js';
import { ProjectorModule } from '../projector/projector.module.js';

/** Root module of the worker process, which has no HTTP server. */
@Module({
  imports: [PostgresModule, MongoModule, ProjectorModule],
  providers: [workerConfigProvider, OutboxPostgresRepository, OutboxWorker],
})
export class OutboxWorkerModule {}
