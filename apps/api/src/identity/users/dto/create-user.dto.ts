import { IsEmail, IsString, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  // No password: login is OAuth-only. The user is invited and signs in with
  // Google / Microsoft 365 using this email.
  @IsEnum(UserRole)
  role!: UserRole;
}
