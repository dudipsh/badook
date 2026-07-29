import { IsInt, Min, Max, IsOptional, IsBoolean } from 'class-validator';

export class UpdateGmailSettingsDto {
  @IsInt()
  @Min(1)
  @Max(365)
  scanDaysBack!: number;

  @IsOptional()
  @IsBoolean()
  scanSent?: boolean;
}
