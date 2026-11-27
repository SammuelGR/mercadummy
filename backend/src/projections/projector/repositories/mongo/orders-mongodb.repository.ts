import { Inject, Injectable } from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import { MONGODB_CONNECTION } from '../../../../database/mongodb/mongo.module.js';
import { ORDER_VIEW_COLLECTION, orderViewSchema } from '../../../../database/mongodb/schemas/order-view.schema.js';
import type { OrderView } from '../../../../database/mongodb/schemas/order-view.schema.js';
import { saveView } from './save-view.js';

/** Writes the `orders` view. Only the projection processes use it. */
@Injectable()
export class OrderViewsMongoRepository {
  private readonly model: Model<OrderView>;

  constructor(@Inject(MONGODB_CONNECTION) connection: Connection) {
    this.model = connection.model<OrderView>('OrderView', orderViewSchema, ORDER_VIEW_COLLECTION);
  }

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
