import { IsIn, IsString, MinLength } from 'class-validator';

export class AddBlockedRuleDto {
  @IsIn(['sender', 'subject'])
  type!: 'sender' | 'subject';

  @IsString()
  @MinLength(1)
  pattern!: string;
}
