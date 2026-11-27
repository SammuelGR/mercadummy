import { Command, CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { SessionsRedisRepository } from '../repositories/sessions-redis.repository.js';

/** Ends the session. The cart is kept. */
export class LogOutUserCommand extends Command<void> {
  constructor(readonly sessionId: string) {
    super();
  }
}

@CommandHandler(LogOutUserCommand)
export class LogOutUserHandler implements ICommandHandler<LogOutUserCommand> {
  constructor(private readonly sessions: SessionsRedisRepository) {}

  async execute(command: LogOutUserCommand): Promise<void> {
    await this.sessions.delete(command.sessionId);
  }
}
