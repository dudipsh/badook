import { IsString, IsOptional } from 'class-validator';

export class SubmitFeedbackDto {
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

  @IsString()
  threeWayMatchId!: string;
}
