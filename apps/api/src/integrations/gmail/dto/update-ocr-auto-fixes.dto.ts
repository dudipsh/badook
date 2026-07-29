import { IsBoolean } from 'class-validator';

export class UpdateOcrAutoFixesDto {
  @IsBoolean()
  enabled!: boolean;
}
