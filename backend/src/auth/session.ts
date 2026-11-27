import type { CookieOptions, Request } from 'express';
import type { UserRole } from '../database/postgres/generated/enums.js';
import type { AuthUserResponse } from './auth.dto.js';

export interface Session {
  userId: string;
  fullName: string;
  role: UserRole;
}

export interface AuthenticatedSession {
  sessionId: string;
  session: Session;
}

export const SESSION_COOKIE_NAME = 'sid';
export const SESSION_TTL_SECONDS = 86_400;

// 32 random bytes encoded in base64url.
const sessionIdPattern = /^[A-Za-z0-9_-]{43}$/;

/** Reads the session id from the `sid` cookie, ignoring values that are not well-formed ids. */
export function readSessionId(request: Request): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (cookieHeader === undefined) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');
    if (separatorIndex !== -1 && cookie.slice(0, separatorIndex).trim() === SESSION_COOKIE_NAME) {
      const value = cookie.slice(separatorIndex + 1).trim();
      return sessionIdPattern.test(value) ? value : undefined;
    }
  }

  return undefined;
}

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/' };
}

/** Result of registration and login: the user's public data and the id of the new session. */
export interface StartedSession {
  user: AuthUserResponse;
  sessionId: string;
}
