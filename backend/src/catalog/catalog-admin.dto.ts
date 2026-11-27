import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const maxInteger = 2_147_483_647;
const maxPrice = 99_999_999.99;
const httpUrl = { protocols: ['http', 'https'], require_protocol: true };
const finiteNumber = { allowNaN: false, allowInfinity: false };
const twoDecimalPlaces = { ...finiteNumber, maxDecimalPlaces: 2 };

/** The field may be left out, but `null` is rejected, so stored records never hold explicit nulls. */
const IsOmittable = (): PropertyDecorator => ValidateIf((_object: object, value: unknown) => value !== undefined);

export class CreateCategoryDto {
  @IsString()
  @Length(1, 60)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase letters, digits and hyphens between them',
  })
  slug!: string;

  @IsString()
  @Length(1, 80)
  name!: string;
}

export class ProductDimensionsDto {
  @IsNumber(finiteNumber)
  @Min(0)
  width!: number;

  @IsNumber(finiteNumber)
  @Min(0)
  height!: number;

  @IsNumber(finiteNumber)
  @Min(0)
  depth!: number;
}

/** Descriptive product attributes stored in `products.details`; unknown keys are rejected. */
export class ProductDetailsDto {
  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOmittable()
  @IsNumber(finiteNumber)
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  brand?: string;

  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  sku?: string;

  @IsOmittable()
  @IsNumber(finiteNumber)
  @Min(0)
  weight?: number;

  @IsOmittable()
  @IsObject()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @IsOmittable()
  @IsString()
  @IsNotEmpty()
  warrantyInformation?: string;

  @IsOmittable()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOmittable()
  @IsArray()
  @IsUrl(httpUrl, { each: true })
  images?: string[];
}

export class CreateProductDto {
  @IsOmittable()
  @IsInt()
  @Min(1)
  @Max(maxInteger)
  externalId?: number;

  @IsUUID()
  categoryId!: string;

  @IsString()
  @Length(1, 150)
  title!: string;

  @IsNumber(twoDecimalPlaces)
  @Min(0)
  @Max(maxPrice)
  price!: number;

  @IsNumber(twoDecimalPlaces)
  @Min(0)
  @Max(100)
  discountPercentage!: number;

  @IsInt()
  @Min(0)
  @Max(maxInteger)
  stock!: number;

  @IsUrl(httpUrl)
  thumbnail!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => ProductDetailsDto)
  details!: ProductDetailsDto;
}

export interface CategoryResponse {
  id: string;
  slug: string;
  name: string;
}

export interface CreatedProductResponse {
  id: string;
  externalId: number | null;
}
