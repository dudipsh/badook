import { IsObject, IsOptional, IsString, IsArray } from 'class-validator';

export class UpdateGroundTruthDto {
  @IsObject()
  groundTruth!: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
