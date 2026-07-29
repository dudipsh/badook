import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { UpdateMailboxDto } from './dto/update-mailbox.dto';

@Injectable()
export class MailboxesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForCompany(companyId: string) {
    const integrations = await this.prisma.companyIntegration.findMany({
      where: { companyId },
      orderBy: { slot: 'asc' },
      select: {
        id: true,
        slot: true,
        type: true,
        status: true,
        externalId: true,
        scanDaysBack: true,
        scanSent: true,
        connectedAt: true,
        lastScannedAt: true,
        errorMessage: true,
      },
    });

    const slots = [1, 2].map((slot) => {
      const found = integrations.find((i) => i.slot === slot);
      if (found) return found;
      return {
        id: null,
        slot,
        type: null,
        status: 'DISCONNECTED' as const,
        externalId: null,
        scanDaysBack: 7,
        scanSent: true,
        connectedAt: null,
        lastScannedAt: null,
        errorMessage: null,
      };
    });
    return { slots };
  }

  async findById(companyId: string, mailboxId: string) {
    const mailbox = await this.prisma.companyIntegration.findUnique({
      where: { id: mailboxId },
    });
    if (!mailbox || mailbox.companyId !== companyId) {
      throw new NotFoundException('Mailbox not found');
    }
    return mailbox;
  }

  async update(companyId: string, mailboxId: string, dto: UpdateMailboxDto) {
    await this.findById(companyId, mailboxId);
    return this.prisma.companyIntegration.update({
      where: { id: mailboxId },
      data: {
        ...(dto.scanDaysBack !== undefined && { scanDaysBack: dto.scanDaysBack }),
        ...(dto.scanSent !== undefined && { scanSent: dto.scanSent }),
      },
      select: {
        id: true,
        slot: true,
        type: true,
        status: true,
        externalId: true,
        scanDaysBack: true,
        scanSent: true,
        connectedAt: true,
        lastScannedAt: true,
      },
    });
  }

  async disconnect(companyId: string, mailboxId: string) {
    await this.findById(companyId, mailboxId);
    return this.prisma.companyIntegration.update({
      where: { id: mailboxId },
      data: {
        status: 'DISCONNECTED',
        credentials: null,
        externalId: null,
        config: Prisma.DbNull,
        connectedAt: null,
      },
    });
  }

  async findFreeSlot(companyId: string): Promise<number> {
    const used = await this.prisma.companyIntegration.findMany({
      where: { companyId, status: 'CONNECTED' },
      select: { slot: true },
    });
    const usedSlots = new Set(used.map((u) => u.slot));
    if (!usedSlots.has(1)) return 1;
    if (!usedSlots.has(2)) return 2;
    throw new BadRequestException('All mailbox slots are in use');
  }
}
