import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '../../database/redis/redis.module.js';
import type { RedisClient } from '../../database/redis/redis.module.js';
import { UserRole } from '../../database/postgres/generated/enums.js';
import { SESSION_TTL_SECONDS } from '../session.js';
import type { Session } from '../session.js';

const userRoles = new Set<string>(Object.values(UserRole));

function sessionKey(sessionId: string): string {
  return `session:${sessionId}`;
}

@Injectable()
export class SessionsRedisRepository {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {}

  /** Stores a new session with its expiration in a single transaction and returns its id. */
  async create(session: Session): Promise<string> {
    const sessionId = randomBytes(32).toString('base64url');
    const key = sessionKey(sessionId);

    await this.redis
      .multi()
      .hSet(key, { userId: session.userId, fullName: session.fullName, role: session.role })
      .expire(key, SESSION_TTL_SECONDS)
      .exec();

    return sessionId;
  }

  /** Returns the session, or null when it does not exist, has expired or is malformed. */
  async find(sessionId: string): Promise<Session | null> {
    const fields: Partial<Record<string, string>> = await this.redis.hGetAll(sessionKey(sessionId));
    const { userId, fullName, role } = fields;

    if (!userId || fullName === undefined || role === undefined || !isUserRole(role)) {
      return null;
    }

    return { userId, fullName, role };
  }

  async delete(sessionId: string): Promise<void> {
    await this.redis.del(sessionKey(sessionId));
  }
}

function isUserRole(value: string): value is UserRole {
  return userRoles.has(value);
}
