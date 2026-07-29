import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MailerService } from '../../infrastructure/mailer/mailer.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async getUsageStats(companyId: string) {
    const logs = await this.prisma.apiUsageLog.findMany({
      where: { companyId },
    });

    const totalCalls = logs.length;
    const totalTokens = logs.reduce((sum, l) => sum + l.totalTokens, 0);
    const totalCost = logs.reduce((sum, l) => sum + Number(l.estimatedCostUsd), 0);

    // Breakdown by provider
    const byProvider: Record<string, { calls: number; tokens: number; cost: number }> = {};
    for (const log of logs) {
      if (!byProvider[log.provider]) byProvider[log.provider] = { calls: 0, tokens: 0, cost: 0 };
      byProvider[log.provider].calls++;
      byProvider[log.provider].tokens += log.totalTokens;
      byProvider[log.provider].cost += Number(log.estimatedCostUsd);
    }

    // Breakdown by operation
    const byOperation: Record<string, { calls: number; tokens: number; cost: number }> = {};
    for (const log of logs) {
      if (!byOperation[log.operation]) byOperation[log.operation] = { calls: 0, tokens: 0, cost: 0 };
      byOperation[log.operation].calls++;
      byOperation[log.operation].tokens += log.totalTokens;
      byOperation[log.operation].cost += Number(log.estimatedCostUsd);
    }

    return { totalCalls, totalTokens, totalCost, byProvider, byOperation };
  }

  async getFeedback(companyId: string, page: number, limit: number) {
    const [data, total] = await Promise.all([
      this.prisma.itemMatchFeedback.findMany({
        where: { companyId },
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.itemMatchFeedback.count({ where: { companyId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateFeedback(
    id: string,
    companyId: string,
    dto: { descriptionA?: string; descriptionB?: string; catalogNumberA?: string; catalogNumberB?: string },
  ) {
    return this.prisma.itemMatchFeedback.update({
      where: { id, companyId },
      data: dto,
    });
  }

  async deleteFeedback(id: string, companyId: string) {
    return this.prisma.itemMatchFeedback.delete({
      where: { id, companyId },
    });
  }

  async getCompanySettings(companyId: string) {
    const settings = await this.prisma.companySettings.findUnique({
      where: { companyId },
    });
    if (!settings) {
      return this.prisma.companySettings.create({
        data: { companyId },
        select: { maxUploadSizeMb: true, defaultVatRate: true },
      });
    }
    return { maxUploadSizeMb: settings.maxUploadSizeMb, defaultVatRate: settings.defaultVatRate };
  }

  async updateCompanySettings(companyId: string, dto: { maxUploadSizeMb?: number; defaultVatRate?: number }) {
    return this.prisma.companySettings.upsert({
      where: { companyId },
      create: {
        companyId,
        ...(dto.maxUploadSizeMb !== undefined && { maxUploadSizeMb: dto.maxUploadSizeMb }),
        ...(dto.defaultVatRate !== undefined && { defaultVatRate: dto.defaultVatRate }),
      },
      update: {
        ...(dto.maxUploadSizeMb !== undefined && { maxUploadSizeMb: dto.maxUploadSizeMb }),
        ...(dto.defaultVatRate !== undefined && { defaultVatRate: dto.defaultVatRate }),
      },
      select: { maxUploadSizeMb: true, defaultVatRate: true },
    });
  }

  async getSystemStats(companyId: string) {
    const [deliveryNotes, purchaseOrders, invoices, suppliers, matches, feedbacks] =
      await Promise.all([
        this.prisma.deliveryNote.count({ where: { companyId } }),
        this.prisma.purchaseOrder.count({ where: { companyId } }),
        this.prisma.invoice.count({ where: { companyId } }),
        this.prisma.supplier.count({ where: { companyId } }),
        this.prisma.threeWayMatch.count({ where: { companyId } }),
        this.prisma.itemMatchFeedback.count({ where: { companyId } }),
      ]);
    return { deliveryNotes, purchaseOrders, invoices, suppliers, matches, feedbacks };
  }

  // Per-company overview for the super-admin Companies tab: headcount,
  // projects, document/match counts and total AI usage.
  async getCompanyOverview(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, email: true, businessId: true, createdAt: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const [users, projects, deliveryNotes, purchaseOrders, invoices, suppliers, matches, feedbacks] =
      await Promise.all([
        this.prisma.user.count({ where: { companyId } }),
        this.prisma.project.count({ where: { companyId } }),
        this.prisma.deliveryNote.count({ where: { companyId } }),
        this.prisma.purchaseOrder.count({ where: { companyId } }),
        this.prisma.invoice.count({ where: { companyId } }),
        this.prisma.supplier.count({ where: { companyId } }),
        this.prisma.threeWayMatch.count({ where: { companyId } }),
        this.prisma.itemMatchFeedback.count({ where: { companyId } }),
      ]);

    const usage = await this.getUsageStats(companyId);

    return {
      company,
      counts: { users, projects, deliveryNotes, purchaseOrders, invoices, suppliers, matches, feedbacks },
      ai: { calls: usage.totalCalls, tokens: usage.totalTokens, costUsd: usage.totalCost },
    };
  }

  async listCompanies() {
    return this.prisma.company.findMany({
      where: { status: { not: 'DELETED' } },
      select: {
        id: true,
        name: true,
        email: true,
        businessId: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Soft delete: the company drops out of the platform but its data is retained
  // and recoverable. Hard-deleting would cascade-wipe all its documents.
  async deleteCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');
    await this.prisma.company.update({
      where: { id },
      data: { status: 'DELETED', deletedAt: new Date() },
    });
    return { id };
  }

  async deleteCompanyUser(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, companyId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'SUPER_ADMIN') {
      throw new BadRequestException('לא ניתן למחוק סופר-אדמין דרך מסך זה');
    }
    try {
      await this.prisma.user.delete({ where: { id: userId } });
    } catch (e: any) {
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new BadRequestException(
          'לא ניתן למחוק את המשתמש — קיימים נתונים המשויכים אליו במערכת',
        );
      }
      throw e;
    }
    return { id: userId };
  }

  async createCompany(dto: { name: string; email?: string; businessId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: { name: dto.name, email: dto.email, businessId: dto.businessId },
        select: { id: true, name: true, email: true, businessId: true, createdAt: true },
      });
      await tx.companySettings.create({ data: { companyId: company.id } });
      await tx.companyScanSettings.create({ data: { companyId: company.id } });
      return company;
    });
  }

  async createCompanyUser(companyId: string, dto: { email: string; name: string; role?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');
    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, role: (dto.role as any) || 'ADMIN', companyId },
      select: { id: true, email: true, name: true, role: true, companyId: true, createdAt: true },
    });
    await this.mailer.sendInvite(user.email, user.name, user.role);
    return user;
  }

  async listCompanyUsers(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCompanyUser(companyId: string, userId: string, dto: { name?: string; email?: string; role?: string }) {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('כתובת אימייל כבר בשימוש');
      }
    }
    return this.prisma.user.update({
      where: { id: userId, companyId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.email && { email: dto.email }),
        ...(dto.role && { role: dto.role as any }),
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    });
  }

  async getJobs(companyId?: string, limit = 50) {
    const where = companyId ? { companyId } : {};
    return this.prisma.processingJob.findMany({
      where,
      include: { company: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── Impersonation ───────────────────────────────────────

  /**
   * Issue a JWT for `userId` so a super admin can act as that user. The token
   * carries an `impersonatedBy` claim for audit and to drive the UI banner.
   */
  async impersonate(superAdminId: string, userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true, companyId: true, language: true, isActive: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.id === superAdminId) {
      throw new BadRequestException('Cannot impersonate yourself');
    }

    const accessToken = this.jwt.sign({
      sub: target.id,
      email: target.email,
      role: target.role,
      companyId: target.companyId,
      impersonatedBy: superAdminId,
    });

    await this.recordLoginEvent({
      email: target.email,
      provider: 'impersonation',
      success: true,
      userId: target.id,
      impersonatedById: superAdminId,
    });

    return {
      accessToken,
      user: {
        id: target.id,
        email: target.email,
        name: target.name,
        role: target.role,
        companyId: target.companyId,
        language: target.language,
      },
    };
  }

  private async recordLoginEvent(data: {
    email: string;
    provider: string;
    success: boolean;
    userId?: string;
    impersonatedById?: string;
  }) {
    try {
      await this.prisma.loginEvent.create({ data });
    } catch {
      // best-effort audit
    }
  }

  // ── Super admins management ──────────────────────────────

  listSuperAdmins() {
    return this.prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true, email: true, name: true, role: true, isActive: true, companyId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createSuperAdmin(dto: { email: string; name: string }) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    const user = existing
      ? await this.prisma.user.update({
          where: { id: existing.id },
          data: { role: 'SUPER_ADMIN', companyId: null, isActive: true },
          select: { id: true, email: true, name: true, role: true, isActive: true, companyId: true, createdAt: true },
        })
      : await this.prisma.user.create({
          data: { email, name: dto.name, role: 'SUPER_ADMIN', companyId: null },
          select: { id: true, email: true, name: true, role: true, isActive: true, companyId: true, createdAt: true },
        });

    if (!existing) await this.mailer.sendInvite(user.email, user.name, user.role);
    return user;
  }

  async deleteSuperAdmin(id: string) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.role !== 'SUPER_ADMIN') {
      throw new NotFoundException('Super admin not found');
    }

    const protectedEmails: string[] = this.config.get('superAdminEmails') || [];
    if (protectedEmails.includes(target.email.toLowerCase())) {
      throw new ForbiddenException('לא ניתן להסיר את הסופר-אדמין הראשי');
    }

    const count = await this.prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
    if (count <= 1) {
      throw new ForbiddenException('חייב להישאר לפחות סופר-אדמין אחד');
    }

    try {
      await this.prisma.user.delete({ where: { id } });
    } catch (e: any) {
      // Foreign-key violation: the user still owns rows (feedbacks, price edits, …).
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new BadRequestException(
          'לא ניתן למחוק את המשתמש — קיימים נתונים המשויכים אליו במערכת',
        );
      }
      throw e;
    }
    return { id };
  }

  // ── Login monitoring ────────────────────────────────────

  async getLoginEvents(page: number, limit: number) {
    const [rows, total] = await Promise.all([
      this.prisma.loginEvent.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.loginEvent.count(),
    ]);

    // Resolve display names for the user ids referenced by the events.
    const userIds = Array.from(
      new Set(rows.flatMap((r) => [r.userId, r.impersonatedById].filter(Boolean) as string[])),
    );
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    const data = rows.map((r) => ({
      ...r,
      userName: r.userId ? byId.get(r.userId)?.name ?? null : null,
      impersonatedByName: r.impersonatedById ? byId.get(r.impersonatedById)?.name ?? null : null,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Global user search (across companies) ───────────────

  searchUsers(q?: string) {
    const term = (q || '').trim();
    return this.prisma.user.findMany({
      where: term
        ? {
            OR: [
              { email: { contains: term, mode: 'insensitive' } },
              { name: { contains: term, mode: 'insensitive' } },
            ],
          }
        : {},
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        companyId: true,
        company: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── System messages ─────────────────────────────────────

  listSystemMessages() {
    return this.prisma.systemMessage.findMany({ orderBy: { createdAt: 'desc' } });
  }

  getActiveSystemMessages() {
    const now = new Date();
    return this.prisma.systemMessage.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createSystemMessage(
    createdById: string,
    dto: { title: string; body: string; level?: string; isActive?: boolean; startsAt?: string; endsAt?: string },
  ) {
    return this.prisma.systemMessage.create({
      data: {
        title: dto.title,
        body: dto.body,
        level: (dto.level as any) || 'INFO',
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        createdById,
      },
    });
  }

  async updateSystemMessage(
    id: string,
    dto: { title?: string; body?: string; level?: string; isActive?: boolean; startsAt?: string | null; endsAt?: string | null },
  ) {
    const existing = await this.prisma.systemMessage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('System message not found');
    return this.prisma.systemMessage.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.level !== undefined && { level: dto.level as any }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.startsAt !== undefined && { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }),
        ...(dto.endsAt !== undefined && { endsAt: dto.endsAt ? new Date(dto.endsAt) : null }),
      },
    });
  }

  async deleteSystemMessage(id: string) {
    const existing = await this.prisma.systemMessage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('System message not found');
    await this.prisma.systemMessage.delete({ where: { id } });
    return { id };
  }

  listChatAgents() {
    return this.prisma.chatAgent.findMany({ orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] });
  }

  createChatAgent(dto: {
    name: string;
    description?: string;
    systemPrompt: string;
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    hasTools?: boolean;
    isEnabled?: boolean;
  }) {
    return this.prisma.chatAgent.create({
      data: {
        name: dto.name,
        description: dto.description,
        systemPrompt: dto.systemPrompt,
        ...(dto.provider && { provider: dto.provider as any }),
        model: dto.model ?? 'gemini-2.5-flash',
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 1500,
        hasTools: dto.hasTools ?? false,
        isEnabled: dto.isEnabled ?? true,
      },
    });
  }

  async updateChatAgent(
    id: string,
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
    const existing = await this.prisma.chatAgent.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('סוכן לא נמצא');
    return this.prisma.chatAgent.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.systemPrompt !== undefined && { systemPrompt: dto.systemPrompt }),
        ...(dto.provider !== undefined && { provider: dto.provider as any }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.temperature !== undefined && { temperature: dto.temperature }),
        ...(dto.maxTokens !== undefined && { maxTokens: dto.maxTokens }),
        ...(dto.hasTools !== undefined && { hasTools: dto.hasTools }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
      },
    });
  }

  async deleteChatAgent(id: string) {
    const agent = await this.prisma.chatAgent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('סוכן לא נמצא');
    if (agent.isDefault) {
      throw new BadRequestException('לא ניתן למחוק את סוכן ברירת המחדל. סמן סוכן אחר תחילה.');
    }
    await this.prisma.chatAgent.delete({ where: { id } });
  }

  async setDefaultChatAgent(id: string) {
    const agent = await this.prisma.chatAgent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('סוכן לא נמצא');
    return this.prisma.$transaction([
      this.prisma.chatAgent.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
      this.prisma.chatAgent.update({ where: { id }, data: { isDefault: true, isEnabled: true } }),
    ]);
  }
}
