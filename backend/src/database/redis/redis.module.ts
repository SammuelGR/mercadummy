import { env } from 'node:process';
import { Inject, Logger, Module } from '@nestjs/common';
import type { FactoryProvider, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { createClient } from '@redis/client';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export type RedisClient = ReturnType<typeof createClient>;

const invalidRedisUrl = 'REDIS_URL must be a valid redis:// or rediss:// connection URL.';

const redisClientProvider: FactoryProvider<RedisClient> = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    const configuredUrl = env.REDIS_URL?.trim();
    if (!configuredUrl) {
      throw new Error('REDIS_URL is required.');
    }

    const url = URL.parse(configuredUrl);
    if (
      !url?.hostname ||
      (url.protocol !== 'redis:' && url.protocol !== 'rediss:') ||
      url.port === '0' ||
      (url.pathname && !/^\/\d*$/.test(url.pathname))
    ) {
      throw new Error(invalidRedisUrl);
    }

    try {
      return createClient({ url: configuredUrl, disableOfflineQueue: true });
    } catch {
      throw new Error(invalidRedisUrl);
    }
  },
};

@Module({ providers: [redisClientProvider], exports: [REDIS_CLIENT] })
export class RedisModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);
  private connectionErrorReported = false;
  private shuttingDown = false;

  constructor(@Inject(REDIS_CLIENT) private readonly client: RedisClient) {}

  onModuleInit(): void {
    this.client.on('error', () => {
      if (!this.connectionErrorReported) {
        this.connectionErrorReported = true;
        this.logger.warn('Redis connection is unavailable.');
      }
    });

    this.client.on('ready', () => {
      if (this.connectionErrorReported) {
        this.connectionErrorReported = false;
        this.logger.log('Redis connection is available again.');
      }
    });

    void this.client.connect().catch(() => {
      if (!this.shuttingDown) {
        this.logger.error('Redis connection attempts stopped.');
      }
    });
  }

  onApplicationShutdown(): void {
    this.shuttingDown = true;
    this.client.destroy();
  }
}
