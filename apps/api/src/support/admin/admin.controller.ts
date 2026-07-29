import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { AdminService } from './admin.service';
import { TrainingExportService } from './training-export.service';
import { OcrService } from '../../intelligence/ocr/ocr.service';
import { VisionApiService } from '../../intelligence/ocr/vision-api.service';
import { PromptsService } from '../../intelligence/prompts/prompts.service';
import { JobsService } from '../../infrastructure/jobs/jobs.service';
import { DeliveryNotesService } from '../../domain/delivery-notes/delivery-notes.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UpdateCompanyUserDto } from './dto/update-company-user.dto';

@Controller('admin')
@UseGuards(AuthGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly trainingExport: TrainingExportService,
    private readonly ocr: OcrService,
    private readonly visionApi: VisionApiService,
    private readonly promptsService: PromptsService,
    private readonly jobsService: JobsService,
    private readonly deliveryNotes: DeliveryNotesService,
  ) {}

  @Get('usage-stats')
  getUsageStats(@CurrentUser('companyId') companyId: string) {
    return this.admin.getUsageStats(companyId);
  }

  @Get('feedback')
  getFeedback(
    @CurrentUser('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getFeedback(
      companyId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Patch('feedback/:id')
  updateFeedback(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: { descriptionA?: string; descriptionB?: string; catalogNumberA?: string; catalogNumberB?: string },
  ) {
    return this.admin.updateFeedback(id, companyId, dto);
  }

  @Delete('feedback/:id')
  deleteFeedback(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.admin.deleteFeedback(id, companyId);
  }

  @Get('system-stats')
  getSystemStats(@CurrentUser('companyId') companyId: string) {
    return this.admin.getSystemStats(companyId);
  }

  @Get('company-settings')
  getCompanySettings(@CurrentUser('companyId') companyId: string) {
    return this.admin.getCompanySettings(companyId);
  }

  @Patch('company-settings')
  updateCompanySettings(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: { maxUploadSizeMb?: number; defaultVatRate?: number },
  ) {
    return this.admin.updateCompanySettings(companyId, dto);
  }

  @Get('companies')
  @UseGuards(SuperAdminGuard)
  listCompanies() {
    return this.admin.listCompanies();
  }

  @Get('companies/:id/stats')
  @UseGuards(SuperAdminGuard)
  getCompanyStats(@Param('id') companyId: string) {
    return this.admin.getCompanyOverview(companyId);
  }

  @Post('companies/:id/reset')
  @UseGuards(SuperAdminGuard)
  resetCompanyData(
    @Param('id') companyId: string,
    @Query('deleteFeedback') deleteFeedback?: string,
  ) {
    return this.deliveryNotes.resetAll(companyId, deleteFeedback === 'true');
  }

  @Post('companies/:id/export-to-training-lab')
  @UseGuards(SuperAdminGuard)
  exportCompanyToTrainingLab(@Param('id') companyId: string) {
    return this.trainingExport.exportCompany(companyId);
  }

  @Post('companies')
  @UseGuards(SuperAdminGuard)
  createCompany(@Body() dto: { name: string; email?: string; businessId?: string }) {
    return this.admin.createCompany(dto);
  }

  @Delete('companies/:id')
  @UseGuards(SuperAdminGuard)
  deleteCompany(@Param('id') id: string) {
    return this.admin.deleteCompany(id);
  }

  @Post('companies/:id/users')
  @UseGuards(SuperAdminGuard)
  createCompanyUser(
    @Param('id') companyId: string,
    @Body() dto: { email: string; name: string; role?: string },
  ) {
    return this.admin.createCompanyUser(companyId, dto);
  }

  @Delete('companies/:id/users/:userId')
  @UseGuards(SuperAdminGuard)
  deleteCompanyUser(
    @Param('id') companyId: string,
    @Param('userId') userId: string,
  ) {
    return this.admin.deleteCompanyUser(companyId, userId);
  }

  @Get('companies/:id/users')
  @UseGuards(SuperAdminGuard)
  listCompanyUsers(@Param('id') companyId: string) {
    return this.admin.listCompanyUsers(companyId);
  }

  @Patch('companies/:id/users/:userId')
  @UseGuards(SuperAdminGuard)
  updateCompanyUser(
    @Param('id') companyId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateCompanyUserDto,
  ) {
    return this.admin.updateCompanyUser(companyId, userId, dto);
  }

  @Get('jobs')
  @UseGuards(SuperAdminGuard)
  getJobs(
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getJobs(companyId, limit ? parseInt(limit, 10) : 50);
  }

  @Post('jobs/:companyId/cancel')
  @UseGuards(SuperAdminGuard)
  cancelCompanyJobs(@Param('companyId') companyId: string) {
    return this.jobsService.cancelAll(companyId);
  }

  @Post('impersonate/:userId')
  @UseGuards(SuperAdminGuard)
  impersonate(
    @CurrentUser('sub') superAdminId: string,
    @Param('userId') userId: string,
  ) {
    return this.admin.impersonate(superAdminId, userId);
  }

  @Get('super-admins')
  @UseGuards(SuperAdminGuard)
  listSuperAdmins() {
    return this.admin.listSuperAdmins();
  }

  @Post('super-admins')
  @UseGuards(SuperAdminGuard)
  createSuperAdmin(@Body() dto: { email: string; name: string }) {
    return this.admin.createSuperAdmin(dto);
  }

  @Delete('super-admins/:id')
  @UseGuards(SuperAdminGuard)
  deleteSuperAdmin(@Param('id') id: string) {
    return this.admin.deleteSuperAdmin(id);
  }

  // ── Login monitoring ────────────────────────────────────

  @Get('login-events')
  @UseGuards(SuperAdminGuard)
  getLoginEvents(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.admin.getLoginEvents(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // ── Global user search ──────────────────────────────────

  @Get('users/search')
  @UseGuards(SuperAdminGuard)
  searchUsers(@Query('q') q?: string) {
    return this.admin.searchUsers(q);
  }

  // ── System messages ─────────────────────────────────────

  // Active messages are readable by ANY authenticated user (drives the banner).
  @Get('system-messages/active')
  getActiveSystemMessages() {
    return this.admin.getActiveSystemMessages();
  }

  @Get('system-messages')
  @UseGuards(SuperAdminGuard)
  listSystemMessages() {
    return this.admin.listSystemMessages();
  }

  @Post('system-messages')
  @UseGuards(SuperAdminGuard)
  createSystemMessage(
    @CurrentUser('sub') userId: string,
    @Body() dto: { title: string; body: string; level?: string; isActive?: boolean; startsAt?: string; endsAt?: string },
  ) {
    return this.admin.createSystemMessage(userId, dto);
  }

  @Patch('system-messages/:id')
  @UseGuards(SuperAdminGuard)
  updateSystemMessage(
    @Param('id') id: string,
    @Body() dto: { title?: string; body?: string; level?: string; isActive?: boolean; startsAt?: string | null; endsAt?: string | null },
  ) {
    return this.admin.updateSystemMessage(id, dto);
  }

  @Delete('system-messages/:id')
  @UseGuards(SuperAdminGuard)
  deleteSystemMessage(@Param('id') id: string) {
    return this.admin.deleteSystemMessage(id);
  }

  /**
   * DEBUG: Diagnostics endpoint — shows OCR provider, dependency status, prompt file hashes, and environment info.
   * Call this on both local and server to compare and find discrepancies.
   */
  @Get('diagnostics')
  @UseGuards(SuperAdminGuard)
  async getDiagnostics(@CurrentUser('companyId') companyId: string) {
    const provider = await this.visionApi.getProvider(companyId);

    // Check mupdf availability
    let mupdfStatus = 'unknown';
    try {
      const mupdf: any = await (Function('return import("mupdf")')());
      const m = mupdf.default || mupdf;
      mupdfStatus = m?.Document ? 'OK' : 'loaded but Document class missing';
    } catch (err) {
      mupdfStatus = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    }

    // Check sharp availability
    let sharpStatus = 'unknown';
    try {
      const sharp = (await import('sharp')).default;
      const meta = await sharp(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')).metadata();
      sharpStatus = meta.width === 1 ? 'OK' : `loaded but test failed (width=${meta.width})`;
    } catch (err) {
      sharpStatus = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
    }

    // Scan prompt template .md files on disk (dist/intelligence/prompts/templates/)
    const templatesDir = path.join(__dirname, '..', '..', '..', '..', 'intelligence', 'prompts', 'templates');
    const promptFiles = this.scanPromptFiles(templatesDir);

    // Get in-memory prompt registry data (what the app actually uses)
    const loadedPrompts = this.promptsService.getAllPrompts().map((p) => ({
      agentType: p.agentType,
      promptKey: p.promptKey,
      name: p.name,
      hash: crypto.createHash('md5').update(p.promptText).digest('hex').slice(0, 12),
      length: p.promptText.length,
    }));

    return {
      companyId,
      ocrProvider: provider,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        nodeEnv: process.env.NODE_ENV || 'undefined',
        uptime: Math.floor(process.uptime()),
      },
      dependencies: {
        mupdf: mupdfStatus,
        sharp: sharpStatus,
      },
      apiKeys: {
        geminiConfigured: !!process.env.GEMINI_API_KEY,
        openaiConfigured: !!process.env.OPENAI_API_KEY,
      },
      infrastructure: {
        redisConfigured: !!process.env.REDIS_URL,
        s3Configured: !!process.env.S3_BUCKET,
        s3Bucket: process.env.S3_BUCKET || null,
      },
      prompts: {
        templatesDir,
        templatesDirExists: fs.existsSync(templatesDir),
        filesOnDisk: promptFiles,
        filesOnDiskCount: promptFiles.length,
        loadedInMemory: loadedPrompts,
        loadedInMemoryCount: loadedPrompts.length,
      },
    };
  }

  private scanPromptFiles(dir: string): Array<{ path: string; hash: string; size: number }> {
    const results: Array<{ path: string; hash: string; size: number }> = [];
    try {
      const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.name.endsWith('.md')) {
            const content = fs.readFileSync(full, 'utf-8');
            results.push({
              path: full.replace(dir + '/', ''),
              hash: crypto.createHash('md5').update(content).digest('hex').slice(0, 12),
              size: content.length,
            });
          }
        }
      };
      walk(dir);
    } catch {
      // dir doesn't exist
    }
    return results;
  }

  /**
   * DEBUG: Run multi-doc detection on a file and return the detected segments (no extraction).
   * Use this to verify the splitting agent is reading page boundaries correctly.
   * Body: { filePath: string }
   */
  @Post('debug/detect')
  debugDetect(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: { filePath: string },
  ) {
    return this.ocr.detectDocumentsInFile(dto.filePath, companyId);
  }

  /**
   * DEBUG: Run extraction directly on a file WITHOUT the splitting agent.
   * The vision model receives ALL pages and must find the relevant document itself.
   * Use this to test if the issue is splitting (wrong pages) or extraction (bad model output).
   * Body: { filePath: string, documentType: 'delivery_note' | 'invoice' | 'purchase_order' }
   */
  @Post('debug/extract')
  async debugExtract(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: { filePath: string; documentType: 'delivery_note' | 'invoice' | 'purchase_order' },
  ) {
    const hint = `\n\nNOTE: This file may contain MULTIPLE documents (a mix of delivery notes, invoices, purchase orders). Extract ONLY the ${dto.documentType.replace('_', ' ')} document(s) you find in this file. Ignore pages that belong to other document types.`;
    switch (dto.documentType) {
      case 'invoice':
        return this.ocr.parseInvoice(dto.filePath, companyId, hint);
      case 'purchase_order':
        return this.ocr.parsePurchaseOrder(dto.filePath, companyId, hint);
      default:
        return this.ocr.parseDeliveryNote(dto.filePath, companyId, hint);
    }
  }

  @Get('chat-agents')
  @UseGuards(SuperAdminGuard)
  listChatAgents() {
    return this.admin.listChatAgents();
  }

  @Post('chat-agents')
  @UseGuards(SuperAdminGuard)
  createChatAgent(
    @Body()
    dto: {
      name: string;
      description?: string;
      systemPrompt: string;
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      hasTools?: boolean;
      isEnabled?: boolean;
    },
  ) {
    return this.admin.createChatAgent(dto);
  }

  @Patch('chat-agents/:id')
  @UseGuards(SuperAdminGuard)
  updateChatAgent(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      description?: string | null;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      hasTools?: boolean;
      isEnabled?: boolean;
    },
  ) {
    return this.admin.updateChatAgent(id, dto);
  }

  @Delete('chat-agents/:id')
  @UseGuards(SuperAdminGuard)
  deleteChatAgent(@Param('id') id: string) {
    return this.admin.deleteChatAgent(id);
  }

  @Post('chat-agents/:id/set-default')
  @UseGuards(SuperAdminGuard)
  setDefaultChatAgent(@Param('id') id: string) {
    return this.admin.setDefaultChatAgent(id);
  }
}
