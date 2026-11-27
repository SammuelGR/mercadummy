import { Inject, Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { CategoryView } from '../../../../database/mongodb/schemas/category-view.schema.js';
import { CATEGORY_VIEW_MODEL } from '../../../../database/mongodb/view-models.module.js';
import { saveView } from './save-view.js';

/** Writes the `categories` view. Only the projection processes use it. */
@Injectable()
export class CategoryViewsMongoRepository {
  constructor(@Inject(CATEGORY_VIEW_MODEL) private readonly model: Model<CategoryView>) {}

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
