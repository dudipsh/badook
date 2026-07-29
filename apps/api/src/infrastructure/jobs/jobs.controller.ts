import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(AuthGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('cancel-all')
  cancelAll(@CurrentUser('companyId') companyId: string) {
    return this.jobsService.cancelAll(companyId);
  }

  @Get('active')
  getActive(@CurrentUser('companyId') companyId: string) {
    return this.jobsService.getActiveByCompany(companyId);
  }

  @Get('recent')
  getRecent(
    @CurrentUser('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobsService.getRecentByCompany(companyId, limit ? parseInt(limit, 10) : 10);
  }
}
