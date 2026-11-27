import { env } from 'node:process';
import { Inject, Logger, Module } from '@nestjs/common';
import type { FactoryProvider, OnApplicationShutdown } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from './generated/client.js';

export const POSTGRES_POOL = Symbol('POSTGRES_POOL');

const postgresPoolProvider: FactoryProvider<Pool> = {
  provide: POSTGRES_POOL,
  useFactory: () => {
    const configuredUrl = env.POSTGRES_URL?.trim();
    if (!configuredUrl) {
      throw new Error('POSTGRES_URL is required.');
    }

    const url = URL.parse(configuredUrl);
    if (!url?.hostname || (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') || url.port === '0') {
      throw new Error('POSTGRES_URL must be a valid postgres:// or postgresql:// connection URL.');
    }

    const pool = new Pool({
      connectionString: configuredUrl,
      connectionTimeoutMillis: 5000,
    });

    const logger = new Logger(PostgresModule.name);
    pool.on('error', () => {
      logger.warn('An idle PostgreSQL connection was lost.');
    });

    return pool;
  },
};

const prismaClientProvider: FactoryProvider<PrismaClient> = {
  provide: PrismaClient,
  inject: [POSTGRES_POOL],
  useFactory: (pool: Pool) => new PrismaClient({ adapter: new PrismaPg(pool, { disposeExternalPool: false }) }),
};

@Module({ providers: [postgresPoolProvider, prismaClientProvider], exports: [POSTGRES_POOL, PrismaClient] })
export class PostgresModule implements OnApplicationShutdown {
  constructor(
    @Inject(POSTGRES_POOL) private readonly pool: Pool,
    @Inject(PrismaClient) private readonly prisma: PrismaClient,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.prisma.$disconnect();
    } finally {
      await this.pool.end();
    }
  }
}
