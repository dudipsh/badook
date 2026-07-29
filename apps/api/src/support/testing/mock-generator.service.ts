import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AgentOrchestratorService } from '../../intelligence/agents/agent-orchestrator.service';
import { AutoMatchService } from '../../domain/matching/auto-match.service';
import { TestingService } from './testing.service';

@Injectable()
export class MockGeneratorService {
  private readonly logger = new Logger(MockGeneratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly autoMatch: AutoMatchService,
    private readonly testingService: TestingService,
  ) {}

  async generateMocks(caseId: string): Promise<{ generated: number; documents: string[] }> {
    const caseMeta = this.testingService.getCase(caseId);
    if (!caseMeta) throw new BadRequestException(`Test case not found: ${caseId}`);

    const casePath = this.testingService.getCasePath(caseId);
    const docsDir = path.join(casePath, 'documents');
    const mocksDir = path.join(casePath, 'mocks');

    if (!fs.existsSync(docsDir)) {
      throw new BadRequestException(`No documents directory for case: ${caseId}`);
    }

    const docFiles = fs.readdirSync(docsDir).filter(
      (f) =>
        f.endsWith('.pdf') ||
        f.endsWith('.png') ||
        f.endsWith('.jpg') ||
        f.endsWith('.jpeg'),
    );

    if (docFiles.length === 0) {
      throw new BadRequestException(`No document files found in case: ${caseId}`);
    }

    // Create a temporary test company
    const testCompany = await this.prisma.company.create({
      data: {
        name: `__test_mock_gen_${caseId}_${Date.now()}`,
      },
    });
    await this.prisma.companySettings.create({ data: { companyId: testCompany.id } });
    await this.prisma.companyScanSettings.create({ data: { companyId: testCompany.id, ocrProvider: 'OPENAI' } });

    const generatedDocs: string[] = [];

    try {
      // Process each document through the full AI pipeline
      for (const docFile of docFiles) {
        const filePath = path.join(docsDir, docFile);
        this.logger.log(`Processing document for mock generation: ${docFile}`);

        await this.orchestrator.processFile({
          companyId: testCompany.id,
          filePath,
          source: 'MANUAL',
          originalFileName: docFile,
          force: true, // Skip duplicate checks
        });
      }

      // Run auto-match to create ThreeWayMatch
      await this.autoMatch.run(testCompany.id);

      // Extract parsed data from created documents
      const [pos, dns, invoices] = await Promise.all([
        this.prisma.purchaseOrder.findMany({
          where: { companyId: testCompany.id },
          include: { lineItems: true },
        }),
        this.prisma.deliveryNote.findMany({
          where: { companyId: testCompany.id },
          include: { lineItems: true },
        }),
        this.prisma.invoice.findMany({
          where: { companyId: testCompany.id },
          include: { lineItems: true },
        }),
      ]);

      // Save mocks
      if (!fs.existsSync(mocksDir)) {
        fs.mkdirSync(mocksDir, { recursive: true });
      }

      for (const po of pos) {
        const fileName = `po-${po.poNumber || po.id.substring(0, 8)}.json`;
        fs.writeFileSync(
          path.join(mocksDir, fileName),
          JSON.stringify(po.parsedData, null, 2),
          'utf-8',
        );
        generatedDocs.push(fileName);
      }

      for (const dn of dns) {
        const fileName = `dn-${(dn as any).noteNumber || dn.id.substring(0, 8)}.json`;
        fs.writeFileSync(
          path.join(mocksDir, fileName),
          JSON.stringify(dn.parsedData, null, 2),
          'utf-8',
        );
        generatedDocs.push(fileName);
      }

      for (const inv of invoices) {
        const fileName = `inv-${inv.invoiceNumber || inv.id.substring(0, 8)}.json`;
        fs.writeFileSync(
          path.join(mocksDir, fileName),
          JSON.stringify(inv.parsedData, null, 2),
          'utf-8',
        );
        generatedDocs.push(fileName);
      }

      // Save match data if exists
      const matches = await this.prisma.threeWayMatch.findMany({
        where: {
          OR: [
            { purchaseOrder: { companyId: testCompany.id } },
            { deliveryNotes: { some: { companyId: testCompany.id } } },
            { invoices: { some: { companyId: testCompany.id } } },
          ],
        },
      });

      if (matches.length > 0) {
        fs.writeFileSync(
          path.join(mocksDir, 'matches.json'),
          JSON.stringify(
            matches.map((m) => ({
              lineItemPairings: m.lineItemPairings,
              discrepancies: m.discrepancies,
              status: m.status,
            })),
            null,
            2,
          ),
          'utf-8',
        );
        generatedDocs.push('matches.json');
      }

      // Update meta.json
      const metaDocuments = [
        ...pos.map((po) => ({
          fileName: docFiles.find((f) => f.toLowerCase().includes('po') || f.toLowerCase().includes('הזמנ')) || docFiles[0],
          type: 'purchase_order' as const,
        })),
        ...dns.map((dn) => ({
          fileName: docFiles.find((f) => f.toLowerCase().includes('dn') || f.toLowerCase().includes('משלוח')) || docFiles[0],
          type: 'delivery_note' as const,
        })),
        ...invoices.map((inv) => ({
          fileName: docFiles.find((f) => f.toLowerCase().includes('inv') || f.toLowerCase().includes('חשבונ')) || docFiles[0],
          type: 'invoice' as const,
        })),
      ];

      this.testingService.updateMeta(caseId, {
        hasMocks: true,
        documents: metaDocuments,
      });

      this.logger.log(`Mock generation complete for ${caseId}: ${generatedDocs.length} files`);
    } finally {
      // Cleanup: delete all test data
      await this.cleanupTestCompany(testCompany.id);
    }

    return { generated: generatedDocs.length, documents: generatedDocs };
  }

  private async cleanupTestCompany(companyId: string): Promise<void> {
    try {
      // Delete in reverse dependency order
      await this.prisma.lineItemAuditLog.deleteMany({
        where: {
          poLineItem: { purchaseOrder: { companyId } },
        },
      });
      await this.prisma.threeWayMatch.deleteMany({
        where: {
          OR: [
            { purchaseOrder: { companyId } },
            { deliveryNotes: { some: { companyId } } },
          ],
        },
      });
      await this.prisma.pOLineItem.deleteMany({
        where: { purchaseOrder: { companyId } },
      });
      await this.prisma.lineItem.deleteMany({
        where: { deliveryNote: { companyId } },
      });
      await this.prisma.invoiceLineItem.deleteMany({
        where: { invoice: { companyId } },
      });
      await this.prisma.purchaseOrder.deleteMany({ where: { companyId } });
      await this.prisma.deliveryNote.deleteMany({ where: { companyId } });
      await this.prisma.invoice.deleteMany({ where: { companyId } });
      await this.prisma.supplier.deleteMany({ where: { companyId } });
      await this.prisma.projectAddress.deleteMany({
        where: { project: { companyId } },
      });
      await this.prisma.project.deleteMany({ where: { companyId } });
      await this.prisma.processingJob.deleteMany({ where: { companyId } });
      await this.prisma.apiUsageLog.deleteMany({ where: { companyId } });
      await this.prisma.company.delete({ where: { id: companyId } });
    } catch (err) {
      this.logger.warn(`Cleanup failed for test company ${companyId}: ${err}`);
    }
  }
}
