import { IsIn } from 'class-validator';
import type { OcrProviderType } from '../../../common/ai-models';

export class UpdateOcrProviderDto {
  @IsIn(['OPENAI', 'GEMINI', 'GEMINI_FINETUNED'])
  provider!: OcrProviderType;
}
