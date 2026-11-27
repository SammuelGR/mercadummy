import { Schema } from 'mongoose';
import type { Types } from 'mongoose';

export type AvailabilityStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

export interface ProductViewCategory {
  id: string;
  slug: string;
  name: string;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductView {
  _id: string;
  title: string;
  titleSearch: string;
  thumbnail: string;
  category: ProductViewCategory;
  price: Types.Decimal128;
  discountPercentage: number;
  stock: number;
  availabilityStatus: AvailabilityStatus;
  rating?: number;
  description: string;
  images: string[];
  specifications: ProductSpecification[];
  isActive: boolean;
  createdAt: Date;
  version: number;
}

export const PRODUCT_VIEW_COLLECTION = 'products';

const categorySchema = new Schema(
  {
    id: String,
    slug: String,
    name: String,
  },
  { _id: false },
);

const specificationSchema = new Schema(
  {
    label: String,
    value: String,
  },
  { _id: false },
);

export const productViewSchema = new Schema(
  {
    _id: String,
    title: String,
    titleSearch: String,
    thumbnail: String,
    category: categorySchema,
    price: Schema.Types.Decimal128,
    discountPercentage: Number,
    stock: Number,
    availabilityStatus: String,
    rating: Number,
    description: String,
    images: [String],
    specifications: [specificationSchema],
    isActive: Boolean,
    createdAt: Date,
    version: Number,
  },
  { versionKey: false, autoIndex: false, autoCreate: false },
);

productViewSchema.index({ isActive: 1, createdAt: 1, _id: 1 }, { name: 'catalog' });
productViewSchema.index({ isActive: 1, 'category.slug': 1, createdAt: 1, _id: 1 }, { name: 'catalog_by_category' });
