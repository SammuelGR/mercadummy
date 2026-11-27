import { env } from 'node:process';
import { Inject, Logger, Module } from '@nestjs/common';
import type { FactoryProvider, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { createConnection, mongo } from 'mongoose';
import type { Connection } from 'mongoose';

export const MONGODB_CONNECTION = Symbol('MONGODB_CONNECTION');
const MONGODB_URL = Symbol('MONGODB_URL');

const mongoUrlProvider: FactoryProvider<string> = {
  provide: MONGODB_URL,
  useFactory: async () => {
    const configuredUrl = env.MONGODB_URL?.trim();
    if (!configuredUrl) {
      throw new Error('MONGODB_URL is required.');
    }

    let validationClient: mongo.MongoClient;
    try {
      // The driver validates standard and SRV connection strings without connecting.
      validationClient = new mongo.MongoClient(configuredUrl);
    } catch {
      throw new Error('MONGODB_URL must be a valid mongodb:// or mongodb+srv:// connection URL.');
    }
    await validationClient.close();

    return configuredUrl;
  },
};

const mongoConnectionProvider: FactoryProvider<Connection> = {
  provide: MONGODB_CONNECTION,
  useFactory: () => createConnection(),
};

@Module({ providers: [mongoUrlProvider, mongoConnectionProvider], exports: [MONGODB_CONNECTION] })
export class MongoModule implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(MongoModule.name);
  private retryTimer?: ReturnType<typeof setTimeout>;
  private connectionErrorReported = false;
  private shuttingDown = false;

  constructor(
    @Inject(MONGODB_URL) private readonly url: string,
    @Inject(MONGODB_CONNECTION) private readonly connection: Connection,
  ) {}

  onModuleInit(): void {
    this.connection.on('error', () => {
      this.reportUnavailable();
    });
    this.connection.on('disconnected', () => {
      this.reportUnavailable();
    });
    this.connection.on('connected', () => {
      if (!this.shuttingDown && this.connectionErrorReported) {
        this.connectionErrorReported = false;
        this.logger.log('MongoDB connection is available again.');
      }
    });

    this.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;
    clearTimeout(this.retryTimer);
    await this.connection.destroy();
  }

  private connect(): void {
    // Mongoose reconnects an established connection, but does not retry a failed initial connection.
    void this.connection.openUri(this.url, { bufferCommands: false, serverSelectionTimeoutMS: 5000 }).catch(() => {
      if (!this.shuttingDown) {
        this.retryTimer = setTimeout(() => {
          this.connect();
        }, 2000);
      }
    });
  }

  private reportUnavailable(): void {
    if (!this.shuttingDown && !this.connectionErrorReported) {
      this.connectionErrorReported = true;
      this.logger.warn('MongoDB connection is unavailable.');
    }
  }
}
