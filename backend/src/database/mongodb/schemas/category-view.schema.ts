import { Schema } from 'mongoose';

export interface CategoryView {
  _id: string;
  slug: string;
  name: string;
  version: number;
}

export const CATEGORY_VIEW_COLLECTION = 'categories';

export const categoryViewSchema = new Schema(
  {
    _id: String,
    slug: String,
    name: String,
    version: Number,
  },
  { versionKey: false, autoIndex: false, autoCreate: false },
);

categoryViewSchema.index({ slug: 1 }, { name: 'slug_unique', unique: true });
