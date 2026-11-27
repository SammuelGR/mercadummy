import { IsEmail, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';
import type { UserRole } from '../../database/postgres/generated/enums.js';

export class RegisterDto {
  @IsString()
  @Length(1, 150)
  @Matches(/^\S(.*\S)?$/s, { message: 'fullName must not start or end with spaces' })
  fullName!: string;

  @IsString()
  @MaxLength(254)
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export interface AuthUserResponse {
  id: string;
  fullName: string;
  role: UserRole;
}
