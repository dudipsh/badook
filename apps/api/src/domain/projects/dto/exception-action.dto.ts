import { IsString, IsOptional, IsIn } from 'class-validator';

export class ExceptionActionDto {
  @IsString()
  @IsIn([
    'OVERRIDE_SUBSTITUTE',
    'OVERRIDE_PRICE_APPROVED',
    'OVERRIDE_UNIT_CORRECTION',
    'FLAG_DUPLICATE',
  ])
  type!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
