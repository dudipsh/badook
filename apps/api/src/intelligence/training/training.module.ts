import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { AuthModule } from '../../identity/auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}
