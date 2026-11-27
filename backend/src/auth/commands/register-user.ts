import { HttpStatus } from '@nestjs/common';
import { Command, CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { ApiException } from '../../common/api-exception.js';
import { hashPassword } from '../password.js';
import { SessionsRedisRepository } from '../repositories/sessions-redis.repository.js';
import { UsersPostgresRepository } from '../repositories/users-postgres.repository.js';
import type { StartedSession } from '../session.js';

export class RegisterUserCommand extends Command<StartedSession> {
  constructor(
    readonly fullName: string,
    readonly email: string,
    readonly password: string,
    readonly previousSessionId: string | undefined,
  ) {
    super();
  }
}

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly users: UsersPostgresRepository,
    private readonly sessions: SessionsRedisRepository,
  ) {}

  async execute(command: RegisterUserCommand): Promise<StartedSession> {
    const user = await this.users.create({
      fullName: command.fullName,
      email: command.email.toLowerCase(),
      passwordHash: await hashPassword(command.password),
    });

    if (user === null) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'EMAIL_ALREADY_IN_USE',
        message: 'Email already registered',
      });
    }

    // The account is already stored: if Redis fails from here on, the user must log in.
    const sessionId = await this.sessions.create({ userId: user.id, fullName: user.fullName, role: user.role });
    if (command.previousSessionId !== undefined) {
      await this.sessions.delete(command.previousSessionId);
    }

    return { user, sessionId };
  }
}
