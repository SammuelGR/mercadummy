import { Inject, Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { ProductView } from '../../../../database/mongodb/schemas/product-view.schema.js';
import { PRODUCT_VIEW_MODEL } from '../../../../database/mongodb/view-models.module.js';
import { saveView } from './save-view.js';

/** Writes the `products` view. Only the projection processes use it. */
@Injectable()
export class ProductViewsMongoRepository {
  constructor(@Inject(PRODUCT_VIEW_MODEL) private readonly model: Model<ProductView>) {}

  /** Creates the indexes declared in the schema; existing identical indexes are left as they are. */
  async createIndexes(): Promise<void> {
    await this.model.createIndexes();
  }

  save(view: ProductView): Promise<void> {
    return saveView(this.model, view);
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: id });
  }
}
