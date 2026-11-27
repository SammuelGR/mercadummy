import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { isPostgresUnavailableError } from '../database/postgres/postgres-errors.js';
import { isRedisUnavailableError } from '../database/redis/redis-errors.js';
import { ApiException } from './api-exception.js';
import type { ApiErrorBody } from './api-exception.js';

interface ApiError {
  status: number;
  body: ApiErrorBody;
}

/** Converts every error into the response format defined in the API contract. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = this.toApiError(exception);
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof ApiException) {
      return { status: exception.getStatus(), body: exception.body };
    }

    if (isPostgresUnavailableError(exception) || isRedisUnavailableError(exception)) {
      this.logger.warn(`A required database is unavailable: ${describe(exception)}`);
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: { code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' },
      };
    }

    if (exception instanceof HttpException && exception.getStatus() < 500) {
      return toClientError(exception.getStatus());
    }

    this.logger.error('Unexpected error', exception instanceof Error ? exception.stack : String(exception));
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
  }
}

// Client errors raised by the framework itself, such as malformed JSON or an unknown route.
const frameworkClientErrors = new Map<number, ApiErrorBody>([
  [HttpStatus.UNAUTHORIZED, { code: 'UNAUTHENTICATED', message: 'Authentication required' }],
  [HttpStatus.FORBIDDEN, { code: 'FORBIDDEN', message: 'Operation not allowed' }],
  [HttpStatus.NOT_FOUND, { code: 'NOT_FOUND', message: 'Route not found' }],
]);

function toClientError(status: number): ApiError {
  return {
    status,
    body: frameworkClientErrors.get(status) ?? { code: 'VALIDATION_ERROR', message: 'Invalid request data' },
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message.split('\n').at(-1) ?? ''}` : String(error);
}
