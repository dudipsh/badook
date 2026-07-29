import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class PairingActionDto {
  @IsInt()
  @Min(0)
  pairingIndex!: number;
}

export class EditMappingDto {
  @IsInt()
  @Min(0)
  pairingIndex!: number;

  @IsString()
  descriptionA!: string;

  @IsString()
  descriptionB!: string;

  @IsOptional()
  @IsString()
  catalogNumberA?: string;

  @IsOptional()
  @IsString()
  catalogNumberB?: string;
}

export class CreateFeedbackDto {
  @IsString()
  descriptionA!: string;

  @IsString()
  descriptionB!: string;

  @IsOptional()
  @IsString()
  catalogNumberA?: string;

  @IsOptional()
  @IsString()
  catalogNumberB?: string;

  @IsString()
  sourceDocType!: string;

  @IsString()
  targetDocType!: string;
}

export class UpdateFeedbackDto {
  @IsOptional()
  @IsString()
  descriptionA?: string;

  @IsOptional()
  @IsString()
  descriptionB?: string;

  @IsOptional()
  @IsString()
  catalogNumberA?: string;

  @IsOptional()
  @IsString()
  catalogNumberB?: string;
}

export class QueryFeedbackDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  feedbackType?: string;
}
