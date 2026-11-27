import { env } from 'node:process';
import type { FactoryProvider } from '@nestjs/common';

export interface HttpConfig {
  /** Exact front-end origin allowed by CORS and by the Origin check on writes. */
  frontendOrigin: string;
  /** Whether cookies carry the Secure attribute; disabled only locally without HTTPS. */
  secureCookies: boolean;
}

export const HTTP_CONFIG = Symbol('HTTP_CONFIG');

export const httpConfigProvider: FactoryProvider<HttpConfig> = {
  provide: HTTP_CONFIG,
  useFactory: () => ({ frontendOrigin: readFrontendOrigin(), secureCookies: readCookieSecure() }),
};

function readFrontendOrigin(): string {
  const configuredOrigin = env.FRONTEND_ORIGIN?.trim();
  if (!configuredOrigin) {
    throw new Error('FRONTEND_ORIGIN is required.');
  }

  const url = URL.parse(configuredOrigin);
  if (!url || (url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== configuredOrigin) {
    throw new Error('FRONTEND_ORIGIN must be an http:// or https:// origin, without a path or trailing slash.');
  }

  return configuredOrigin;
}

function readCookieSecure(): boolean {
  const configuredValue = env.COOKIE_SECURE?.trim();
  if (!configuredValue || configuredValue === 'true') {
    return true;
  }

  if (configuredValue === 'false') {
    return false;
  }

  throw new Error('COOKIE_SECURE must be true or false.');
}
