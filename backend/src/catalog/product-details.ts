import type { Prisma } from '../database/postgres/generated/client.js';
import type { ProductDetailsDto } from './catalog-admin.dto.js';

/** Converts validated details into the `products.details` object, leaving out the keys that were not sent. */
export function toProductDetails(dto: ProductDetailsDto): Prisma.InputJsonObject {
  const { dimensions } = dto;
  const entries: [string, Prisma.InputJsonValue | undefined][] = [
    ['description', dto.description],
    ['rating', dto.rating],
    ['brand', dto.brand],
    ['sku', dto.sku],
    ['weight', dto.weight],
    ['dimensions', dimensions && { width: dimensions.width, height: dimensions.height, depth: dimensions.depth }],
    ['warrantyInformation', dto.warrantyInformation],
    ['tags', dto.tags],
    ['images', dto.images],
  ];

  return Object.fromEntries(entries.filter((entry) => entry[1] !== undefined));
}
