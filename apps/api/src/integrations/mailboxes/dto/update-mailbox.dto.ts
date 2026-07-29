import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateMailboxDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  scanDaysBack?: number;

  @IsOptional()
  @IsBoolean()
  scanSent?: boolean;
}
