import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from './api-exception.js';
import { HTTP_CONFIG } from './http-config.js';
import type { HttpConfig } from './http-config.js';

const readOnlyMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Rejects writes sent from an origin other than the front end. Requests without Origin,
 * such as those from the migration script, are accepted and still require each route's authentication.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(HTTP_CONFIG) private readonly config: HttpConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;

    if (readOnlyMethods.has(request.method) || origin === undefined || origin === this.config.frontendOrigin) {
      return true;
    }

    throw new ApiException(HttpStatus.FORBIDDEN, { code: 'INVALID_ORIGIN', message: 'Origin not allowed' });
  }
}
