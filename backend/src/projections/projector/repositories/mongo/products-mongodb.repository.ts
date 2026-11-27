import { Inject, Injectable } from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import { MONGODB_CONNECTION } from '../../../../database/mongodb/mongo.module.js';
import {
  PRODUCT_VIEW_COLLECTION,
  productViewSchema,
} from '../../../../database/mongodb/schemas/product-view.schema.js';
import type { ProductView } from '../../../../database/mongodb/schemas/product-view.schema.js';
import { saveView } from './save-view.js';

/** Writes the `products` view. Only the projection processes use it. */
@Injectable()
export class ProductViewsMongoRepository {
  private readonly model: Model<ProductView>;

  constructor(@Inject(MONGODB_CONNECTION) connection: Connection) {
    this.model = connection.model<ProductView>('ProductView', productViewSchema, PRODUCT_VIEW_COLLECTION);
  }

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
