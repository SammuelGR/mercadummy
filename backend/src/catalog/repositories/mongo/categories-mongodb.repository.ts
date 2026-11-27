import { Inject, Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { CategoryView } from '../../../database/mongodb/schemas/category-view.schema.js';
import { CATEGORY_VIEW_MODEL } from '../../../database/mongodb/view-models.module.js';

/** Reads the `categories` view. */
@Injectable()
export class CategoriesMongoRepository {
  constructor(@Inject(CATEGORY_VIEW_MODEL) private readonly categories: Model<CategoryView>) {}

  findAllSortedByName(): Promise<CategoryView[]> {
    return this.categories.find().sort({ name: 1 }).lean<CategoryView[]>().exec();
  }
}
