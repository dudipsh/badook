import { IsString, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateCompanyUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
