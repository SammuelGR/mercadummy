import { isUUID } from 'class-validator';

/** Position after the last product of a page, in the catalog order (`createdAt`, then `_id`). */
export interface ProductCursor {
  createdAt: Date;
  id: string;
}

const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

/** Encodes the cursor as base64url JSON; clients treat it as an opaque string. */
export function encodeProductCursor(cursor: ProductCursor): string {
  const payload = { createdAt: cursor.createdAt.toISOString(), id: cursor.id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Decodes a cursor received from a client, or returns null when it is not one this API produced. */
export function decodeProductCursor(cursor: string): ProductCursor | null {
  // Buffer.from silently skips characters outside the alphabet, so check them first.
  if (!base64UrlPattern.test(cursor)) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const { createdAt, id } = payload as Record<string, unknown>;
  if (typeof createdAt !== 'string' || typeof id !== 'string' || !isUUID(id)) {
    return null;
  }

  // Only the exact format produced by `toISOString` is accepted.
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== createdAt) {
    return null;
  }

  return { createdAt: date, id };
}
