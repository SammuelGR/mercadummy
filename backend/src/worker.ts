import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { NestFactory } from '@nestjs/core';
import { OutboxWorkerModule } from './projections/outbox-worker/outbox-worker.module.js';

if (existsSync('.env')) {
  loadEnvFile();
}

// An application context without an HTTP server: the worker only polls the outbox.
const app = await NestFactory.createApplicationContext(OutboxWorkerModule);
app.enableShutdownHooks();
