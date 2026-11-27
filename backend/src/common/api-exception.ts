import { HttpException } from '@nestjs/common';
import type { HttpStatus } from '@nestjs/common';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'INVALID_ORIGIN'
  | 'NOT_FOUND'
  | 'PRODUCT_NOT_FOUND'
  | 'EMAIL_ALREADY_IN_USE'
  | 'CATEGORY_ALREADY_EXISTS'
  | 'PRODUCT_ALREADY_EXISTS'
  | 'SKU_ALREADY_IN_USE'
  | 'CATEGORY_NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  fields?: ApiFieldError[];
  /** Id of the record that already exists, in `CATEGORY_ALREADY_EXISTS` and `PRODUCT_ALREADY_EXISTS`. */
  existingId?: string;
}

/** An error whose body follows the error format defined in the API contract. */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly body: ApiErrorBody,
  ) {
    super(body, status);
  }
}
