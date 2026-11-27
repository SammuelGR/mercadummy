import { Module } from '@nestjs/common';
import type { FactoryProvider } from '@nestjs/common';
import type { Connection, Model } from 'mongoose';
import { MONGODB_CONNECTION, MongoModule } from './mongo.module.js';
import { CATEGORY_VIEW_COLLECTION, categoryViewSchema } from './schemas/category-view.schema.js';
import type { CategoryView } from './schemas/category-view.schema.js';
import { ORDER_VIEW_COLLECTION, orderViewSchema } from './schemas/order-view.schema.js';
import type { OrderView } from './schemas/order-view.schema.js';
import { PRODUCT_VIEW_COLLECTION, productViewSchema } from './schemas/product-view.schema.js';
import type { ProductView } from './schemas/product-view.schema.js';

export const CATEGORY_VIEW_MODEL = Symbol('CATEGORY_VIEW_MODEL');
export const PRODUCT_VIEW_MODEL = Symbol('PRODUCT_VIEW_MODEL');
export const ORDER_VIEW_MODEL = Symbol('ORDER_VIEW_MODEL');

// Each model is registered once per connection: registering the same name twice throws OverwriteModelError.
const categoryViewModelProvider: FactoryProvider<Model<CategoryView>> = {
  provide: CATEGORY_VIEW_MODEL,
  inject: [MONGODB_CONNECTION],
  useFactory: (connection: Connection) =>
    connection.model<CategoryView>('CategoryView', categoryViewSchema, CATEGORY_VIEW_COLLECTION),
};

const productViewModelProvider: FactoryProvider<Model<ProductView>> = {
  provide: PRODUCT_VIEW_MODEL,
  inject: [MONGODB_CONNECTION],
  useFactory: (connection: Connection) =>
    connection.model<ProductView>('ProductView', productViewSchema, PRODUCT_VIEW_COLLECTION),
};

const orderViewModelProvider: FactoryProvider<Model<OrderView>> = {
  provide: ORDER_VIEW_MODEL,
  inject: [MONGODB_CONNECTION],
  useFactory: (connection: Connection) =>
    connection.model<OrderView>('OrderView', orderViewSchema, ORDER_VIEW_COLLECTION),
};

/** Mongoose models of the read views, shared by the projections (writes) and the business modules (queries). */
@Module({
  imports: [MongoModule],
  providers: [categoryViewModelProvider, productViewModelProvider, orderViewModelProvider],
  exports: [CATEGORY_VIEW_MODEL, PRODUCT_VIEW_MODEL, ORDER_VIEW_MODEL],
})
export class ViewModelsModule {}
