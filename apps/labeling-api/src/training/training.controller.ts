import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/auth.guard';
import { TrainingService } from './training.service';
import { StartTrainingDto } from './dto/start-training.dto';

@Controller('training')
@UseGuards(ApiKeyGuard)
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post('start')
  start(@Body() dto: StartTrainingDto) {
    return this.trainingService.start(dto);
  }

  @Get('jobs')
  list() {
    return this.trainingService.list();
  }

  @Get('jobs/:id')
  get(@Param('id') id: string) {
    return this.trainingService.get(id);
  }
}
