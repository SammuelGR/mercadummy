import { HttpStatus } from '@nestjs/common';
import { Command, CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { ApiException } from '../../common/api-exception.js';
import { verifyPassword } from '../password.js';
import { SessionsRedisRepository } from '../repositories/sessions-redis.repository.js';
import { UsersPostgresRepository } from '../repositories/users-postgres.repository.js';
import type { StartedSession } from '../session.js';

export class LogInUserCommand extends Command<StartedSession> {
  constructor(
    readonly email: string,
    readonly password: string,
    readonly previousSessionId: string | undefined,
  ) {
    super();
  }
}

@CommandHandler(LogInUserCommand)
export class LogInUserHandler implements ICommandHandler<LogInUserCommand> {
  constructor(
    private readonly users: UsersPostgresRepository,
    private readonly sessions: SessionsRedisRepository,
  ) {}

  async execute(command: LogInUserCommand): Promise<StartedSession> {
    const user = await this.users.findCredentialsByEmail(command.email);
    const passwordMatches = await verifyPassword(command.password, user?.passwordHash);

    // A missing e-mail and a wrong password get the same response.
    if (user === null || !passwordMatches) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const sessionId = await this.sessions.create({ userId: user.id, fullName: user.fullName, role: user.role });
    if (command.previousSessionId !== undefined) {
      await this.sessions.delete(command.previousSessionId);
    }

    return { user: { id: user.id, fullName: user.fullName, role: user.role }, sessionId };
  }
}
