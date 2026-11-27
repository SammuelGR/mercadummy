import {
  ClientClosedError,
  ClientOfflineError,
  ConnectionTimeoutError,
  SocketClosedUnexpectedlyError,
  SocketTimeoutError,
} from '@redis/client';

export function isRedisUnavailableError(error: unknown): boolean {
  return (
    error instanceof ClientOfflineError ||
    error instanceof ClientClosedError ||
    error instanceof ConnectionTimeoutError ||
    error instanceof SocketClosedUnexpectedlyError ||
    error instanceof SocketTimeoutError
  );
}
