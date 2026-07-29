import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { TestingService } from './testing.service';
import { TestRunnerService } from './test-runner.service';
import { MockGeneratorService } from './mock-generator.service';

@Controller('testing')
@UseGuards(AuthGuard, SuperAdminGuard)
export class TestingController {
  constructor(
    private readonly testing: TestingService,
    private readonly runner: TestRunnerService,
    private readonly mockGen: MockGeneratorService,
  ) {}

  @Get('cases')
  listCases() {
    return this.testing.listCases();
  }

  @Get('cases/:id')
  getCase(@Param('id') id: string) {
    return this.testing.getCase(id);
  }

  @Post('cases/:id/run-live')
  runLive(@Param('id') id: string) {
    return this.runner.runLive(id);
  }

  @Post('cases/:id/run-mock')
  runMock(@Param('id') id: string) {
    return this.runner.runMock(id);
  }

  @Post('run-all-mocks')
  runAllMocks() {
    return this.runner.runAllMocks();
  }

  @Post('cases/:id/generate-mocks')
  generateMocks(@Param('id') id: string) {
    return this.mockGen.generateMocks(id);
  }

  @Get('results')
  getResults(@Query('limit') limit?: string) {
    return this.testing.getResults(limit ? parseInt(limit, 10) : 50);
  }
}
