import { IsString, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateAllowedPhoneDto {
  @IsString()
  @Matches(/^\d{10,15}$/, { message: 'Phone number must be 10-15 digits' })
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  contactName?: string;
}

export class UpdateAllowedPhoneDto {
  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
