import { existsSync } from 'node:fs';
import { env, loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) {
  loadEnvFile();
}

const postgresUrl = env.POSTGRES_URL?.trim();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: postgresUrl === '' ? undefined : postgresUrl },
});
