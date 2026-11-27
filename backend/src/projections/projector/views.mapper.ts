import { Types } from 'mongoose';
import type { CategoryView } from '../../database/mongodb/schemas/category-view.schema.js';
import type { OrderView } from '../../database/mongodb/schemas/order-view.schema.js';
import { normalizeSearchText } from '../../database/mongodb/schemas/product-view.schema.js';
import type {
  AvailabilityStatus,
  ProductSpecification,
  ProductView,
} from '../../database/mongodb/schemas/product-view.schema.js';

// Row shapes of the `load-*` queries. Money and percentages come as text, so they never pass through a float.

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  version: number;
}

export interface ProductRow {
  id: string;
  title: string;
  thumbnail: string;
  price: string;
  discount_percentage: string;
  stock: number;
  details: unknown;
  is_active: boolean;
  created_at: Date;
  version: number;
  category_id: string;
  category_slug: string;
  category_name: string;
}

export interface OrderItemRow {
  productId: string;
  title: string;
  thumbnail: string;
  price: string;
  quantity: number;
}

export interface OrderRow {
  id: string;
  order_number: number;
  user_id: string;
  status: string;
  created_at: Date;
  total_quantity: number;
  total: string;
  version: number;
  items: OrderItemRow[];
}

/** Proposed rule: 0 is out of stock, 1 to 7 is low stock, 8 or more is in stock. */
export function availabilityStatus(stock: number): AvailabilityStatus {
  if (stock === 0) {
    return 'Out of Stock';
  }
  return stock <= 7 ? 'Low Stock' : 'In Stock';
}

/** Rounds the stored discount for display: 10.48 → 10; 10.50 → 11. */
export function displayDiscount(discountPercentage: string): number {
  return Math.round(Number(discountPercentage));
}

/** Builds the specification list in display order, leaving out missing items. */
export function productSpecifications(details: Record<string, unknown>): ProductSpecification[] {
  const specifications: ProductSpecification[] = [];
  const brand = readText(details.brand);
  const sku = readText(details.sku);
  const weight = readNumber(details.weight);
  const dimensions = readDimensions(details.dimensions);
  const warranty = readText(details.warrantyInformation);

  if (brand !== undefined) specifications.push({ label: 'Brand', value: brand });
  if (sku !== undefined) specifications.push({ label: 'SKU', value: sku });
  if (weight !== undefined) specifications.push({ label: 'Weight', value: String(weight) });
  if (dimensions !== undefined) {
    const { width, height, depth } = dimensions;
    specifications.push({
      label: 'Dimensions (W × H × D)',
      value: `${String(width)} × ${String(height)} × ${String(depth)}`,
    });
  }
  if (warranty !== undefined) specifications.push({ label: 'Warranty', value: warranty });

  return specifications;
}

export function toCategoryView(row: CategoryRow): CategoryView {
  return { _id: row.id, slug: row.slug, name: row.name, version: row.version };
}

export function toProductView(row: ProductRow): ProductView {
  const details = isRecord(row.details) ? row.details : {};
  const rating = readNumber(details.rating);

  return {
    _id: row.id,
    title: row.title,
    titleSearch: normalizeSearchText(row.title),
    thumbnail: row.thumbnail,
    category: { id: row.category_id, slug: row.category_slug, name: row.category_name },
    price: new Types.Decimal128(row.price),
    discountPercentage: displayDiscount(row.discount_percentage),
    stock: row.stock,
    availabilityStatus: availabilityStatus(row.stock),
    ...(rating === undefined ? {} : { rating }),
    description: readText(details.description) ?? '',
    images: Array.isArray(details.images) ? details.images.filter((image) => typeof image === 'string') : [],
    specifications: productSpecifications(details),
    isActive: row.is_active,
    createdAt: row.created_at,
    version: row.version,
  };
}

export function toOrderView(row: OrderRow): OrderView {
  return {
    _id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id,
    status: row.status,
    createdAt: row.created_at,
    totalQuantity: row.total_quantity,
    total: new Types.Decimal128(row.total),
    items: row.items.map((item) => ({
      productId: item.productId,
      title: item.title,
      thumbnail: item.thumbnail,
      price: new Types.Decimal128(item.price),
      quantity: item.quantity,
    })),
    version: row.version,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readDimensions(value: unknown): { width: number; height: number; depth: number } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const width = readNumber(value.width);
  const height = readNumber(value.height);
  const depth = readNumber(value.depth);
  return width === undefined || height === undefined || depth === undefined ? undefined : { width, height, depth };
}
