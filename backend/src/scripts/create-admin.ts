import 'reflect-metadata';
import { existsSync } from 'node:fs';
import process, { env, exit, loadEnvFile } from 'node:process';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../auth/dto/auth.dto.js';
import { hashPassword } from '../auth/password.js';
import { UsersPostgresRepository } from '../auth/repositories/users-postgres.repository.js';
import { PrismaClient } from '../database/postgres/generated/client.js';
import { UserRole } from '../database/postgres/generated/enums.js';
import { PostgresModule } from '../database/postgres/postgres.module.js';

/**
 * Creates an `admin` account directly in PostgreSQL; the API has no route for it.
 * Reads ADMIN_FULL_NAME, ADMIN_EMAIL and ADMIN_PASSWORD, so the password does not go into the shell history.
 */
if (existsSync('.env')) {
  loadEnvFile();
}

const input = plainToInstance(RegisterDto, {
  fullName: env.ADMIN_FULL_NAME ?? 'Administrator',
  email: env.ADMIN_EMAIL,
  password: env.ADMIN_PASSWORD,
});

// Same rules as registration through the API.
const errors = await validate(input);
if (errors.length > 0) {
  for (const error of errors) {
    const messages = Object.values(error.constraints ?? {}).join('; ');
    console.error(`Invalid ${error.property}: ${messages}`);
  }
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8 to 128 characters); ADMIN_FULL_NAME is optional.');
  exit(1);
}

// Only warnings and errors: the script prints its own result.
Logger.overrideLogger(['error', 'warn']);
const app = await NestFactory.createApplicationContext(PostgresModule);

try {
  const users = new UsersPostgresRepository(app.get(PrismaClient));
  const admin = await users.create({
    fullName: input.fullName,
    email: input.email.toLowerCase(),
    passwordHash: await hashPassword(input.password),
    role: UserRole.admin,
  });

  if (admin === null) {
    console.error(`An account with the e-mail ${input.email.toLowerCase()} already exists; nothing was changed.`);
    process.exitCode = 1;
  } else {
    console.log(`Admin account created: ${input.email.toLowerCase()} (${admin.id}).`);
  }
} finally {
  await app.close();
}
