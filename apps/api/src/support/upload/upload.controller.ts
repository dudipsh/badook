import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JobsService } from '../../infrastructure/jobs/jobs.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const ALLOWED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

@Controller('upload')
export class UploadController {
  constructor(
    private readonly service: UploadService,
    private readonly jobsService: JobsService,
  ) {}

  @Post('delivery-note')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_MIMES.includes(file.mimetype));
      },
    }),
  )
  async uploadDeliveryNote(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @Body('projectId') projectId?: string,
    @Body('force') force?: string,
    @Body('docType') docType?: string,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');

    const job = await this.jobsService.create({
      companyId,
      fileName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      userId,
      projectId: projectId ?? undefined,
    });

    // Fire-and-forget: processing runs in background
    this.service.processUpload(file, companyId, 'MANUAL', userId, projectId, force === 'true', job.id, docType);

    return { jobId: job.id };
  }

  @Post('manual-scan')
  @UseGuards(AuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      limits: { fileSize: 100 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, ALLOWED_MIMES.includes(file.mimetype));
      },
    }),
  )
  async manualScan(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Body('force') force?: string,
    @Body('companyId') targetCompanyId?: string,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Super-admins may target another company (e.g. ingesting on a customer's
    // behalf from the Operations screen); everyone else uploads to their own.
    const effectiveCompanyId = await this.service.resolveManualScanCompany(
      targetCompanyId,
      role,
      companyId,
    );

    // Fire-and-forget: processing runs in background with WebSocket events
    this.service.processManualScan(files, effectiveCompanyId, userId, force === 'true');

    return { started: true, fileCount: files.length };
  }

  @Post('rescan/:type/:id')
  @UseGuards(AuthGuard)
  async rescan(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    if (!['delivery-note', 'invoice', 'purchase-order'].includes(type)) {
      throw new BadRequestException('Invalid document type');
    }
    return this.service.rescan(type as 'delivery-note' | 'invoice' | 'purchase-order', id, companyId);
  }

  @Post('rescan-all')
  @UseGuards(AuthGuard)
  async rescanAll(@CurrentUser('companyId') companyId: string) {
    return this.service.rescanAll(companyId);
  }
}
