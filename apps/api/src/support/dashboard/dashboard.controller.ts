import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser('companyId') companyId: string) {
    return this.service.getSummary(companyId);
  }

  @Get('by-supplier')
  getBySupplier(@CurrentUser('companyId') companyId: string) {
    return this.service.getBySupplier(companyId);
  }

  @Get('recent')
  getRecent(@CurrentUser('companyId') companyId: string) {
    return this.service.getRecent(companyId);
  }
}
