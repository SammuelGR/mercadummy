import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { HTTP_CONFIG, httpConfigProvider } from './http-config.js';
import { OriginGuard } from './origin.guard.js';
import { createValidationPipe } from './validation.pipe.js';

/** HTTP concerns shared by every route: configuration, error format, validation and the Origin check. */
@Global()
@Module({
  providers: [
    httpConfigProvider,
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
  exports: [HTTP_CONFIG],
})
export class CommonModule {}
