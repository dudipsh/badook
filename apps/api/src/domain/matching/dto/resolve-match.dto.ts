import { IsOptional, IsString } from 'class-validator';

export class ResolveMatchDto {
  @IsOptional() @IsString() notes?: string;
}
