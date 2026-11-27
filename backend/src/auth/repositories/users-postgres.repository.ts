import { Injectable } from '@nestjs/common';
import { PrismaClient } from '../../database/postgres/generated/client.js';
import type { UserRole } from '../../database/postgres/generated/enums.js';
import { isUniqueConstraintViolation } from '../../database/postgres/postgres-errors.js';

export interface NewUser {
  fullName: string;
  email: string;
  passwordHash: string;
  /** Defaults to `user`. Only the `admin:create` script creates administrators. */
  role?: UserRole;
}

export interface UserAccount {
  id: string;
  fullName: string;
  role: UserRole;
}

export interface UserCredentials extends UserAccount {
  passwordHash: string;
}

interface UserCredentialsRow {
  id: string;
  full_name: string;
  role: UserRole;
  password_hash: string;
}

@Injectable()
export class UsersPostgresRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Creates a user, or returns null when the e-mail is already registered. */
  async create(user: NewUser): Promise<UserAccount | null> {
    try {
      return await this.prisma.user.create({
        data: user,
        select: { id: true, fullName: true, role: true },
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  /** Finds a user by e-mail, ignoring case, through the unique index on `lower(email)`. */
  async findCredentialsByEmail(email: string): Promise<UserCredentials | null> {
    const rows = await this.prisma.$queryRaw<UserCredentialsRow[]>`
      SELECT id, full_name, role, password_hash
      FROM users
      WHERE lower(email) = lower(${email})
    `;

    const row = rows.at(0);
    return row === undefined
      ? null
      : { id: row.id, fullName: row.full_name, role: row.role, passwordHash: row.password_hash };
  }
}
