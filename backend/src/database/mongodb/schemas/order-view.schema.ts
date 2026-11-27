import { Schema } from 'mongoose';
import type { Types } from 'mongoose';

export interface OrderViewItem {
  productId: string;
  title: string;
  thumbnail: string;
  price: Types.Decimal128;
  quantity: number;
}

export interface OrderView {
  _id: string;
  orderNumber: number;
  userId: string;
  status: string;
  createdAt: Date;
  totalQuantity: number;
  total: Types.Decimal128;
  items: OrderViewItem[];
  version: number;
}

export const ORDER_VIEW_COLLECTION = 'orders';

const orderItemSchema = new Schema(
  {
    productId: String,
    title: String,
    thumbnail: String,
    price: Schema.Types.Decimal128,
    quantity: Number,
  },
  { _id: false },
);

export const orderViewSchema = new Schema(
  {
    _id: String,
    orderNumber: Number,
    userId: String,
    status: String,
    createdAt: Date,
    totalQuantity: Number,
    total: Schema.Types.Decimal128,
    items: [orderItemSchema],
    version: Number,
  },
  { versionKey: false, autoIndex: false, autoCreate: false },
);

orderViewSchema.index({ userId: 1, createdAt: -1, _id: -1 }, { name: 'by_user' });
