import { Inject, Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { OrderView } from '../../../../database/mongodb/schemas/order-view.schema.js';
import { ORDER_VIEW_MODEL } from '../../../../database/mongodb/view-models.module.js';
import { saveView } from './save-view.js';

/** Writes the `orders` view. Only the projection processes use it. */
@Injectable()
export class OrderViewsMongoRepository {
  constructor(@Inject(ORDER_VIEW_MODEL) private readonly model: Model<OrderView>) {}

  /** Creates the indexes declared in the schema; existing identical indexes are left as they are. */
  async createIndexes(): Promise<void> {
    await this.model.createIndexes();
  }

  save(view: OrderView): Promise<void> {
    return saveView(this.model, view);
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: id });
  }
}
