import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/create-supplier.dto';

@Controller('suppliers')
@UseGuards(AuthGuard)
export class SuppliersController {
  constructor(private readonly service: SuppliersService) {}

  @Get()
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.findOne(id, companyId);
  }

  @Post()
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.service.update(id, dto, companyId);
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.delete(id, companyId);
  }

  @Post(':id/merge')
  merge(
    @Param('id') targetId: string,
    @CurrentUser('companyId') companyId: string,
    @Body('sourceId') sourceId: string,
  ) {
    return this.service.merge(targetId, sourceId, companyId);
  }

  @Get(':id/delivery-notes')
  getDeliveryNotes(
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.service.getDeliveryNotes(id, companyId);
  }
}
