import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { env, loadEnvFile } from 'node:process';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { HTTP_CONFIG } from './common/http-config.js';
import type { HttpConfig } from './common/http-config.js';

if (existsSync('.env')) {
  loadEnvFile();
}

const configuredPort = env.PORT ?? '3000';
const port = Number(configuredPort);

if (!/^\d+$/.test(configuredPort) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const app = await NestFactory.create(AppModule);
app.enableCors({ origin: app.get<HttpConfig>(HTTP_CONFIG).frontendOrigin, credentials: true });
app.enableShutdownHooks();
await app.listen(port);
