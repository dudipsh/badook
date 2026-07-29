import { Controller, Get, UseGuards } from '@nestjs/common';
import { PromptsService } from './prompts.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('prompts')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PromptsController {
  constructor(private readonly prompts: PromptsService) {}

  @Get()
  getAll() {
    return this.prompts.getAllPrompts();
  }
}
