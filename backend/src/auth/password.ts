import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';

// OWASP-recommended scrypt parameters (N=2^15, r=8, p=3), using 32 MiB per hash.
const defaultParameters = { N: 2 ** 15, r: 8, p: 3 } as const;
const keyLength = 64;
const saltLength = 16;
const maxMemory = 64 * 1024 * 1024;

interface StoredHash {
  parameters: { N: number; r: number; p: number };
  salt: Buffer;
  key: Buffer;
}

/** Hashes a password into `scrypt$N$r$p$salt$key`, with base64url salt and key. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(saltLength);
  const key = await deriveKey(password, salt, defaultParameters);
  const { N, r, p } = defaultParameters;
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

/**
 * Checks a password against a stored hash. Without a stored hash, it still derives a key and returns false,
 * so a missing e-mail and a wrong password take a similar time.
 */
export async function verifyPassword(password: string, storedHash: string | undefined): Promise<boolean> {
  if (storedHash === undefined) {
    await deriveKey(password, randomBytes(saltLength), defaultParameters);
    return false;
  }

  const { parameters, salt, key } = parseStoredHash(storedHash);
  const derivedKey = await deriveKey(password, salt, parameters);
  return derivedKey.length === key.length && timingSafeEqual(derivedKey, key);
}

const storedHashPattern = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([\w-]+)\$([\w-]+)$/;

function parseStoredHash(storedHash: string): StoredHash {
  const match = storedHashPattern.exec(storedHash);
  if (match === null) {
    throw new Error('Unsupported password hash format.');
  }

  const [, N, r, p, salt, key] = match;
  return {
    parameters: { N: Number(N), r: Number(r), p: Number(p) },
    salt: Buffer.from(salt, 'base64url'),
    key: Buffer.from(key, 'base64url'),
  };
}

function deriveKey(password: string, salt: Buffer, parameters: StoredHash['parameters']): Promise<Buffer> {
  const options: ScryptOptions = { ...parameters, maxmem: maxMemory };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, keyLength, options, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}
