import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LabelingModule } from './labeling/labeling.module';
import { RefDataModule } from './ref-data/ref-data.module';
import { TrainingModule } from './training/training.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LabelingModule,
    RefDataModule,
    TrainingModule,
  ],
})
export class AppModule {}
