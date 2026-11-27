import type { Types } from 'mongoose';
import type { CategoryView } from '../../database/mongodb/schemas/category-view.schema.js';
import type { ProductView } from '../../database/mongodb/schemas/product-view.schema.js';
import type { CategoryResponse, ProductDetailResponse, ProductListItemResponse } from '../dto/catalog.dto.js';

/** Fields of the product view used by the catalog list. */
export type ProductListView = Omit<ProductView, 'titleSearch' | 'description' | 'images' | 'specifications'>;

export function toCategoryResponse(view: CategoryView): CategoryResponse {
  return { id: view._id, slug: view.slug, name: view.name };
}

export function toProductListItem(view: ProductListView): ProductListItemResponse {
  return {
    id: view._id,
    title: view.title,
    thumbnail: view.thumbnail,
    category: { id: view.category.id, slug: view.category.slug, name: view.category.name },
    price: toMoney(view.price),
    discountPercentage: view.discountPercentage,
    ...(view.rating === undefined ? {} : { rating: view.rating }),
    stock: view.stock,
    availabilityStatus: view.availabilityStatus,
  };
}

export function toProductDetail(view: ProductView): ProductDetailResponse {
  return {
    ...toProductListItem(view),
    description: view.description,
    images: view.images,
    specifications: view.specifications.map(({ label, value }) => ({ label, value })),
  };
}

/** The views store money as Decimal128 with 2 decimal places; the API returns it as a number. */
function toMoney(value: Types.Decimal128): number {
  return Number(value.toString());
}
