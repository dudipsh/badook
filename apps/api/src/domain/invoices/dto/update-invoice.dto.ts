import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateInvoiceDto {
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsString() supplierName?: string;
  @IsOptional() @IsString() supplierId?: string;
  @IsOptional() @IsString() invoiceDate?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsNumber() totalAmount?: number;
  @IsOptional() @IsNumber() vatAmount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
}
