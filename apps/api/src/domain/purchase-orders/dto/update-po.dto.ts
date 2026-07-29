import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdatePODto {
  @IsOptional() @IsString() poNumber?: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsOptional() @IsString() orderDate?: string;
  @IsOptional() @IsString() expectedDelivery?: string;
  @IsOptional() @IsNumber() totalAmount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}
