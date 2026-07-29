import { IsString, IsOptional, IsNumber, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

// ─── Query ───

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

// ─── Supplier ───

export class CreateSupplierDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

// ─── Product ───

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsString()
  unit!: string;

  @Type(() => Number)
  @IsNumber()
  avgPrice!: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variants?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commonVendors?: string[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  avgPrice?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variants?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  commonVendors?: string[];
}

// ─── City ───

export class CreateCityDto {
  @Type(() => Number)
  @IsNumber()
  code!: number;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  englishName?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  council?: string;
}

export class UpdateCityDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  code?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  englishName?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  council?: string;
}
