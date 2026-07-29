import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceLineItemDto {
  @IsString() description!: string;
  @IsOptional() @IsString() catalogNumber?: string;
  @IsNumber() quantity!: number;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsNumber() unitPrice?: number;
  @IsOptional() @IsNumber() totalPrice?: number;
}

export class CreateInvoiceDto {
  @IsString() invoiceNumber!: string;
  @IsString() supplierName!: string;
  @IsOptional() @IsString() invoiceDate?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsNumber() totalAmount?: number;
  @IsOptional() @IsNumber() vatAmount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  lineItems?: CreateInvoiceLineItemDto[];
}
