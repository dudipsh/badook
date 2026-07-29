import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QuerySamplesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsEnum(['PENDING', 'AUTO_EXTRACTED', 'LABELED', 'VERIFIED'])
  status?: string;

  @IsOptional()
  @IsEnum(['DELIVERY_NOTE', 'INVOICE', 'PURCHASE_ORDER'])
  documentType?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
