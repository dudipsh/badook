import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class StartTrainingDto {
  @IsOptional()
  @IsString()
  baseModel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  epochs?: number;

  @IsOptional()
  @IsString()
  startedBy?: string;
}
