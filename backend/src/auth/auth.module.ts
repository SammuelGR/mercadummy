import { Module } from '@nestjs/common';
import { PostgresModule } from '../database/postgres/postgres.module.js';
import { RedisModule } from '../database/redis/redis.module.js';
import { AuthController } from './auth.controller.js';
import { LogInUserHandler } from './commands/log-in-user.js';
import { LogOutUserHandler } from './commands/log-out-user.js';
import { RegisterUserHandler } from './commands/register-user.js';
import { GetCurrentUserHandler } from './queries/get-current-user.js';
import { SessionsRedisRepository } from './repositories/sessions-redis.repository.js';
import { UsersPostgresRepository } from './repositories/users-postgres.repository.js';
import { SessionGuard } from './session.guard.js';

@Module({
  imports: [PostgresModule, RedisModule],
  controllers: [AuthController],
  providers: [
    RegisterUserHandler,
    LogInUserHandler,
    LogOutUserHandler,
    GetCurrentUserHandler,
    UsersPostgresRepository,
    SessionsRedisRepository,
    SessionGuard,
  ],
})
export class AuthModule {}
