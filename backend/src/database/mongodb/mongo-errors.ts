import { Error as MongooseError, mongo } from 'mongoose';

/** Connection failures, as opposed to errors caused by a specific command or document. */
export function isMongoUnavailableError(error: unknown): boolean {
  return (
    error instanceof mongo.MongoNetworkError ||
    error instanceof mongo.MongoServerSelectionError ||
    error instanceof mongo.MongoNotConnectedError ||
    error instanceof MongooseError.MongooseServerSelectionError
  );
}

/** Duplicate key on `_id`: the only conflict expected from a versioned upsert. */
export function isDuplicateIdError(error: unknown): boolean {
  if (!(error instanceof mongo.MongoServerError) || error.code !== 11000) {
    return false;
  }
  const keyPattern = error.keyPattern as Record<string, unknown> | undefined;
  return keyPattern?._id === 1;
}
