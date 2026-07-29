import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(companyId: string) {
    const monthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const [totalNotes, pendingReview, approvedThisMonth, amountResult] =
      await Promise.all([
        this.prisma.deliveryNote.count({ where: { companyId } }),
        this.prisma.deliveryNote.count({
          where: { companyId, status: { in: ['PENDING', 'PARSED'] } },
        }),
        this.prisma.deliveryNote.count({
          where: {
            companyId,
            status: 'APPROVED',
            approvedAt: { gte: monthStart },
          },
        }),
        this.prisma.deliveryNote.aggregate({
          where: {
            companyId,
            status: 'APPROVED',
            approvedAt: { gte: monthStart },
          },
          _sum: { totalAmount: true },
        }),
      ]);

    return {
      totalNotes,
      pendingReview,
      approvedThisMonth,
      totalAmountThisMonth: amountResult._sum.totalAmount?.toNumber() ?? 0,
    };
  }

  async getBySupplier(companyId: string) {
    const results = await this.prisma.deliveryNote.groupBy({
      by: ['supplierName'],
      where: { companyId },
      _count: true,
      _sum: { totalAmount: true },
      orderBy: { _count: { supplierName: 'desc' } },
      take: 10,
    });

    return results.map((r) => ({
      supplierName: r.supplierName,
      noteCount: r._count,
      totalAmount: r._sum.totalAmount?.toNumber() ?? 0,
    }));
  }

  async getRecent(companyId: string) {
    return this.prisma.deliveryNote.findMany({
      where: { companyId },
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
}
