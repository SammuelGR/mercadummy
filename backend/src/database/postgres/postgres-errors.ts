import { Prisma } from './generated/client.js';

// Prisma error codes for connection failures and connection pool timeouts.
const unavailableErrorCodes = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024']);

// Driver adapter error kinds reported when the server cannot serve the query, including for raw queries (P2010).
const unavailableAdapterErrorKinds = new Set([
  'DatabaseNotReachable',
  'ConnectionClosed',
  'SocketTimeout',
  'TooManyConnections',
  'TlsConnectionError',
]);

export function isPostgresUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (unavailableErrorCodes.has(error.code)) {
    return true;
  }

  const kind = readAdapterErrorKind(error.meta);
  return kind !== undefined && unavailableAdapterErrorKinds.has(kind);
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function readAdapterErrorKind(meta: Record<string, unknown> | undefined): string | undefined {
  const adapterError = meta?.driverAdapterError;
  if (typeof adapterError !== 'object' || adapterError === null || !('cause' in adapterError)) {
    return undefined;
  }

  const cause = adapterError.cause;
  if (typeof cause !== 'object' || cause === null || !('kind' in cause) || typeof cause.kind !== 'string') {
    return undefined;
  }

  return cause.kind;
}
