import { existsSync } from 'node:fs';
import { env, loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';

if (existsSync('.env')) {
  loadEnvFile();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env.POSTGRES_URL?.trim() || undefined },
});
