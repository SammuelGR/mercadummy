import { Inject, Injectable } from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import { MONGODB_CONNECTION } from '../../../../database/mongodb/mongo.module.js';
import {
  CATEGORY_VIEW_COLLECTION,
  categoryViewSchema,
} from '../../../../database/mongodb/schemas/category-view.schema.js';
import type { CategoryView } from '../../../../database/mongodb/schemas/category-view.schema.js';
import { saveView } from './save-view.js';

/** Writes the `categories` view. Only the projection processes use it. */
@Injectable()
export class CategoryViewsMongoRepository {
  private readonly model: Model<CategoryView>;

  constructor(@Inject(MONGODB_CONNECTION) connection: Connection) {
    this.model = connection.model<CategoryView>('CategoryView', categoryViewSchema, CATEGORY_VIEW_COLLECTION);
  }

  /** Creates the indexes declared in the schema; existing identical indexes are left as they are. */
  async createIndexes(): Promise<void> {
    await this.model.createIndexes();
  }

  save(view: CategoryView): Promise<void> {
    return saveView(this.model, view);
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: id });
  }
}
