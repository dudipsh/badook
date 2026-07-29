import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { ApiKeyGuard } from '../auth/auth.guard';
import { LabelingService } from './labeling.service';
import { ExportService } from './export.service';
import { UploadSampleDto } from './dto/upload-sample.dto';
import { ImportSampleDto } from './dto/import-sample.dto';
import { UpdateGroundTruthDto } from './dto/update-ground-truth.dto';
import { UpdateDocumentTypeDto } from './dto/update-document-type.dto';
import { QuerySamplesDto } from './dto/query-samples.dto';
import type { AiModelInfo } from '../common/ai-models';

@Controller()
export class LabelingController {
  constructor(
    private readonly labelingService: LabelingService,
    private readonly exportService: ExportService,
  ) {}

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('samples/check-duplicate')
  @UseGuards(ApiKeyGuard)
  async checkDuplicate(
    @Query('fileName') fileName: string,
  ) {
    return this.labelingService.checkDuplicate(fileName);
  }

  @Post('samples/upload')
  @UseGuards(ApiKeyGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadSampleDto,
  ) {
    if (dto.replaceId) {
      await this.labelingService.remove(dto.replaceId);
    }
    return this.labelingService.uploadAndExtract(file, dto.documentType || 'DELIVERY_NOTE');
  }

  @Post('samples/import')
  @UseGuards(ApiKeyGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async importWithGroundTruth(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportSampleDto,
  ) {
    let groundTruth: Record<string, unknown>;
    try {
      groundTruth = JSON.parse(dto.groundTruth);
    } catch {
      throw new HttpException(
        'groundTruth must be valid JSON',
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.labelingService.importWithGroundTruth(
      file,
      dto.documentType || 'DELIVERY_NOTE',
      groundTruth,
      dto.originalFileName,
    );
  }

  @Get('samples')
  @UseGuards(ApiKeyGuard)
  async findAll(@Query() query: QuerySamplesDto) {
    return this.labelingService.findAll(query);
  }

  @Get('stats')
  @UseGuards(ApiKeyGuard)
  async getStats() {
    return this.labelingService.getStats();
  }

  @Get('samples/:id')
  @UseGuards(ApiKeyGuard)
  async findOne(@Param('id') id: string) {
    return this.labelingService.findOne(id);
  }

  @Patch('samples/:id/ground-truth')
  @UseGuards(ApiKeyGuard)
  async updateGroundTruth(
    @Param('id') id: string,
    @Body() dto: UpdateGroundTruthDto,
  ) {
    return this.labelingService.updateGroundTruth(id, dto);
  }

  @Patch('samples/:id/document-type')
  @UseGuards(ApiKeyGuard)
  async updateDocumentType(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTypeDto,
  ) {
    return this.labelingService.updateDocumentType(id, dto.documentType);
  }

  @Post('samples/:id/verify')
  @UseGuards(ApiKeyGuard)
  async verify(@Param('id') id: string) {
    return this.labelingService.verify(id);
  }

  @Post('samples/:id/re-extract')
  @UseGuards(ApiKeyGuard)
  async reExtract(@Param('id') id: string) {
    return this.labelingService.reExtract(id);
  }

  @Post('samples/:id/re-extract-finetuned')
  @UseGuards(ApiKeyGuard)
  async reExtractFinetuned(@Param('id') id: string) {
    return this.labelingService.reExtractFinetuned(id);
  }

  @Get('models')
  @UseGuards(ApiKeyGuard)
  getModels(): AiModelInfo[] {
    return this.labelingService.getAvailableModels();
  }

  @Delete('samples/:id')
  @UseGuards(ApiKeyGuard)
  async remove(@Param('id') id: string) {
    return this.labelingService.remove(id);
  }

  @Get('files/:sampleId')
  async getFile(@Param('sampleId') sampleId: string, @Res() res: Response) {
    const filePath = this.labelingService.getFilePath(sampleId);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = ext === '.pdf' ? 'application/pdf' : 'image/png';
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${path.basename(filePath)}"`,
    );
    fs.createReadStream(filePath).pipe(res);
  }

  @Post('export')
  @UseGuards(ApiKeyGuard)
  async exportData(
    @Body() body: { documentType?: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER'; format?: string; minStatus?: 'LABELED' | 'VERIFIED' },
  ) {
    return this.exportService.exportTrainingData(body);
  }

  @Post('export/vertex-ai')
  @UseGuards(ApiKeyGuard)
  async exportForVertexAI(
    @Body() body: { documentType?: 'DELIVERY_NOTE' | 'INVOICE' | 'PURCHASE_ORDER'; minStatus?: 'LABELED' | 'VERIFIED' },
  ) {
    return this.exportService.exportForVertexAI(body);
  }

  @Get('exports')
  @UseGuards(ApiKeyGuard)
  async listExports() {
    return this.exportService.listExports();
  }

  @Get('exports/:id/download')
  @UseGuards(ApiKeyGuard)
  async downloadExport(@Param('id') id: string, @Res() res: Response) {
    const filePath = await this.exportService.getExportPath(id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
    fs.createReadStream(filePath).pipe(res);
  }
}
