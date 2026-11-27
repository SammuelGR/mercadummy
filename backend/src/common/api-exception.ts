import { HttpException } from '@nestjs/common';
import type { HttpStatus } from '@nestjs/common';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'INVALID_ORIGIN'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_IN_USE'
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
