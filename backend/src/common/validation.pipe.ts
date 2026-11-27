import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ApiException } from './api-exception.js';
import type { ApiFieldError } from './api-exception.js';

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    exceptionFactory: (errors: ValidationError[]) =>
      new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        fields: toFieldErrors(errors),
      }),
  });
}

// Each field reports one failed rule: the topmost decorator, since decorators are evaluated bottom-up.
// Nested fields use dot paths.
function toFieldErrors(errors: ValidationError[], parentPath?: string): ApiFieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath === undefined ? error.property : `${parentPath}.${error.property}`;
    const message = error.constraints === undefined ? undefined : Object.values(error.constraints).at(-1);
    const ownError: ApiFieldError[] = message === undefined ? [] : [{ field, message }];
    return [...ownError, ...toFieldErrors(error.children ?? [], field)];
  });
}
