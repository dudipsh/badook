import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateAiSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() defaultModel?: string;
  @IsOptional() @IsString() fileModel?: string;
  @IsOptional() @IsInt() @Min(1000) @Max(1_000_000) maxContextTokens?: number;
  @IsOptional() @IsInt() @Min(0) @Max(65_536) thinkingBudget?: number;
  @IsOptional() @IsInt() @Min(256) @Max(65_536) maxOutputTokens?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) monthlyQueryQuota?: number;
  @IsOptional() @IsInt() @Min(1) @Max(20) maxAttachmentsPerMessage?: number;
  @IsOptional() @IsInt() @Min(1) @Max(50) maxAttachmentSizeMb?: number;
  @IsOptional() @IsBoolean() autoFilterLargeFiles?: boolean;
}
