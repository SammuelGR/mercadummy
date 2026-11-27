import { createParamDecorator, HttpStatus, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from '../common/api-exception.js';
import { SessionsRedisRepository } from './repositories/sessions-redis.repository.js';
import { readSessionId } from './session.js';
import type { AuthenticatedSession } from './session.js';

interface AuthenticatedRequest extends Request {
  authenticatedSession?: AuthenticatedSession;
}

/** Requires a valid session in Redis. A Redis failure propagates as 503, never as a missing session. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionsRedisRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId = readSessionId(request);
    const session = sessionId === undefined ? null : await this.sessions.find(sessionId);

    if (sessionId === undefined || session === null) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, { code: 'UNAUTHENTICATED', message: 'Authentication required' });
    }

    request.authenticatedSession = { sessionId, session };
    return true;
  }
}

/** Injects the session validated by `SessionGuard`. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => {
    const { authenticatedSession } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (authenticatedSession === undefined) {
      throw new Error('CurrentSession requires SessionGuard.');
    }
    return authenticatedSession;
  },
);
