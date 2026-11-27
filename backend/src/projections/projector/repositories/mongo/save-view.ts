import type { Model } from 'mongoose';
import { isDuplicateIdError } from '../../../../database/mongodb/mongo-errors.js';

interface VersionedView {
  _id: string;
  version: number;
}

/**
 * Replaces the document unless MongoDB holds a newer version. A stored higher version makes the upsert
 * try to insert and fail on `_id`, which leaves it unchanged. The second attempt covers two simultaneous
 * inserts of a new document, where the error can occur even for the newest version.
 */
export async function saveView<T extends VersionedView>(model: Model<T>, view: T): Promise<void> {
  const filter = { _id: view._id, version: { $lte: view.version } };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await model.replaceOne(filter, view, { upsert: true });
      return;
    } catch (error) {
      if (!isDuplicateIdError(error)) {
        throw error;
      }
    }
  }
  // Duplicate twice: MongoDB already has a newer version.
}
