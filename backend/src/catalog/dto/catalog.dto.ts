import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { AvailabilityStatus, ProductSpecification } from '../../database/mongodb/schemas/product-view.schema.js';

export const DEFAULT_PRODUCTS_LIMIT = 12;
export const MAX_PRODUCTS_LIMIT = 100;

// Query string values arrive as text; unparseable values are kept as they are, so validation rejects them.
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;
const toInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** An unknown slug is not an error: it yields an empty list. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  inStock?: boolean;

  /** Opaque `nextCursor` of the previous page; its content is validated by the query handler. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(MAX_PRODUCTS_LIMIT)
  limit?: number;
}

export interface CategoryResponse {
  id: string;
  slug: string;
  name: string;
}

export interface CategoryListResponse {
  items: CategoryResponse[];
}

export interface ProductListItemResponse {
  id: string;
  title: string;
  thumbnail: string;
  category: CategoryResponse;
  price: number;
  discountPercentage: number;
  rating?: number;
  stock: number;
  availabilityStatus: AvailabilityStatus;
}

export interface ProductListResponse {
  items: ProductListItemResponse[];
  nextCursor: string | null;
}

export interface ProductDetailResponse extends ProductListItemResponse {
  description: string;
  images: string[];
  specifications: ProductSpecification[];
}
