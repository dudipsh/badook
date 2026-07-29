import { IsString, IsIn } from 'class-validator';

export class UpdateLanguageDto {
  @IsString()
  @IsIn(['he', 'en'])
  language!: string;
}
