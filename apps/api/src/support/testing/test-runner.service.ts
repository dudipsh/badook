import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AgentOrchestratorService } from '../../intelligence/agents/agent-orchestrator.service';
import { AutoMatchService } from '../../domain/matching/auto-match.service';
import { buildLineItem } from '../../domain/projects/build-line-item';
import { TestingService } from './testing.service';
import type {
  TestRunResult,
  AssertionResult,
  TestAssertions,
} from './testing.types';
import type {
  ParsedPurchaseOrder,
  ParsedDeliveryNote,
  ParsedInvoice,
} from '../../intelligence/ocr/ocr.types';

@Injectable()
export class TestRunnerService {
  private readonly logger = new Logger(TestRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly autoMatch: AutoMatchService,
    private readonly testingService: TestingService,
  ) {}

  async runLive(caseId: string): Promise<TestRunResult> {
    const startedAt = new Date().toISOString();
    const caseMeta = this.testingService.getCase(caseId);
    if (!caseMeta) throw new BadRequestException(`Test case not found: ${caseId}`);

    const casePath = this.testingService.getCasePath(caseId);
    const docsDir = path.join(casePath, 'documents');

    const docFiles = fs.existsSync(docsDir)
      ? fs.readdirSync(docsDir).filter(
          (f) =>
            f.endsWith('.pdf') ||
            f.endsWith('.png') ||
            f.endsWith('.jpg') ||
            f.endsWith('.jpeg'),
        )
      : [];

    if (docFiles.length === 0) {
      throw new BadRequestException(`No documents found for live scan in case: ${caseId}`);
    }

    const testCompany = await this.prisma.company.create({
      data: {
        name: `__test_live_${caseId}_${Date.now()}`,
      },
    });
    await this.prisma.companySettings.create({ data: { companyId: testCompany.id } });
    await this.prisma.companyScanSettings.create({ data: { companyId: testCompany.id, ocrProvider: 'OPENAI' } });

    try {
      // Process each document through the full AI pipeline
      for (const docFile of docFiles) {
        await this.orchestrator.processFile({
          companyId: testCompany.id,
          filePath: path.join(docsDir, docFile),
          source: 'MANUAL',
          originalFileName: docFile,
          force: true,
        });
      }

      // Run matching
      await this.autoMatch.run(testCompany.id);

      // Evaluate results
      const assertions = await this.evaluateResults(testCompany.id, casePath);
      const completedAt = new Date().toISOString();

      const result: TestRunResult = {
        runId: `${Date.now()}-${caseId}`,
        caseId,
        caseName: caseMeta.name,
        mode: 'live',
        status: assertions.every((a) => a.passed) ? 'passed' : 'failed',
        startedAt,
        completedAt,
        duration: Date.now() - new Date(startedAt).getTime(),
        assertions,
      };

      this.testingService.saveResult(result);
      return result;
    } catch (err) {
      const completedAt = new Date().toISOString();
      const result: TestRunResult = {
        runId: `${Date.now()}-${caseId}`,
        caseId,
        caseName: caseMeta.name,
        mode: 'live',
        status: 'error',
        startedAt,
        completedAt,
        duration: Date.now() - new Date(startedAt).getTime(),
        assertions: [],
        error: err instanceof Error ? err.message : String(err),
      };
      this.testingService.saveResult(result);
      return result;
    } finally {
      await this.cleanupTestCompany(testCompany.id);
    }
  }

  async runMock(caseId: string): Promise<TestRunResult> {
    const startedAt = new Date().toISOString();
    const caseMeta = this.testingService.getCase(caseId);
    if (!caseMeta) throw new BadRequestException(`Test case not found: ${caseId}`);
    if (!caseMeta.hasMocks) {
      throw new BadRequestException(`No mocks available for case: ${caseId}. Generate mocks first.`);
    }

    const casePath = this.testingService.getCasePath(caseId);
    const mocksDir = path.join(casePath, 'mocks');

    const testCompany = await this.prisma.company.create({
      data: {
        name: `__test_mock_${caseId}_${Date.now()}`,
      },
    });
    await this.prisma.companySettings.create({ data: { companyId: testCompany.id } });
    await this.prisma.companyScanSettings.create({ data: { companyId: testCompany.id, ocrProvider: 'OPENAI' } });

    try {
      // Load mock data and insert directly into DB
      await this.insertMockData(testCompany.id, mocksDir);

      // Run matching on the mock data
      await this.autoMatch.run(testCompany.id);

      // Evaluate results
      const assertions = await this.evaluateResults(testCompany.id, casePath);
      const completedAt = new Date().toISOString();

      const result: TestRunResult = {
        runId: `${Date.now()}-${caseId}`,
        caseId,
        caseName: caseMeta.name,
        mode: 'mock',
        status: assertions.every((a) => a.passed) ? 'passed' : 'failed',
        startedAt,
        completedAt,
        duration: Date.now() - new Date(startedAt).getTime(),
        assertions,
      };

      this.testingService.saveResult(result);
      return result;
    } catch (err) {
      const completedAt = new Date().toISOString();
      const result: TestRunResult = {
        runId: `${Date.now()}-${caseId}`,
        caseId,
        caseName: caseMeta.name,
        mode: 'mock',
        status: 'error',
        startedAt,
        completedAt,
        duration: Date.now() - new Date(startedAt).getTime(),
        assertions: [],
        error: err instanceof Error ? err.message : String(err),
      };
      this.testingService.saveResult(result);
      return result;
    } finally {
      await this.cleanupTestCompany(testCompany.id);
    }
  }

  async runAllMocks(): Promise<TestRunResult[]> {
    const cases = this.testingService.listCases();
    const mockCases = cases.filter((c) => c.hasMocks);
    const results: TestRunResult[] = [];

    for (const tc of mockCases) {
      const result = await this.runMock(tc.id);
      results.push(result);
    }

    return results;
  }

  private async insertMockData(companyId: string, mocksDir: string): Promise<void> {
    const files = fs.readdirSync(mocksDir).filter((f) => f.endsWith('.json'));

    // Create a default supplier
    const supplier = await this.prisma.supplier.create({
      data: { companyId, name: '__test_supplier' },
    });

    for (const file of files) {
      if (file === 'matches.json') continue;

      const data = JSON.parse(
        fs.readFileSync(path.join(mocksDir, file), 'utf-8'),
      );

      if (file.startsWith('po-')) {
        const parsed = data as ParsedPurchaseOrder;
        await this.prisma.purchaseOrder.create({
          data: {
            companyId,
            poNumber: parsed.poNumber || file,
            supplierName: parsed.supplierName,
            supplierId: supplier.id,
            parsedData: data,
            totalAmount: parsed.totalAmount,
            source: 'MANUAL',
            status: 'PARSED',
            lineItems: {
              create: (parsed.lineItems || []).map((li, i) => ({
                description: li.description,
                catalogNumber: li.catalogNumber,
                quantity: li.quantity,
                unit: li.unit,
                unitPrice: li.unitPrice,
                totalPrice: li.totalPrice,
                sortOrder: i,
                discountPercent: li.discountPercent,
                discountAmount: li.discountAmount,
                priceBeforeDiscount: li.priceBeforeDiscount,
              })),
            },
          },
        });
      } else if (file.startsWith('dn-')) {
        const parsed = data as ParsedDeliveryNote;
        await this.prisma.deliveryNote.create({
          data: {
            companyId,
            noteNumber: parsed.noteNumber || file,
            supplierName: parsed.supplierName,
            supplierId: supplier.id,
            parsedData: data,
            totalAmount: parsed.totalAmount,
            deliveryDate: parsed.deliveryDate ? new Date(parsed.deliveryDate) : null,
            source: 'MANUAL',
            status: 'PARSED',
            originalFileUrl: '',
            lineItems: {
              create: (parsed.lineItems || []).map((li, i) => ({
                description: li.description,
                catalogNumber: li.catalogNumber,
                quantity: li.quantity,
                unit: li.unit,
                unitPrice: li.unitPrice,
                totalPrice: li.totalPrice,
                sortOrder: i,
                delivered: true,
              })),
            },
          },
        });
      } else if (file.startsWith('inv-')) {
        const parsed = data as ParsedInvoice;
        await this.prisma.invoice.create({
          data: {
            companyId,
            invoiceNumber: parsed.invoiceNumber || file,
            supplierName: parsed.supplierName,
            supplierId: supplier.id,
            parsedData: data,
            totalAmount: parsed.totalAmount,
            invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : null,
            source: 'MANUAL',
            status: 'PARSED',
            lineItems: {
              create: (parsed.lineItems || []).map((li, i) => ({
                description: li.description,
                catalogNumber: li.catalogNumber,
                quantity: li.quantity,
                unit: li.unit,
                unitPrice: li.unitPrice,
                totalPrice: li.totalPrice,
                sortOrder: i,
              })),
            },
          },
        });
      }
    }
  }

  private async evaluateResults(
    companyId: string,
    casePath: string,
  ): Promise<AssertionResult[]> {
    const assertionsPath = path.join(casePath, 'expected', 'assertions.json');
    if (!fs.existsSync(assertionsPath)) {
      return [{ name: 'assertions.json exists', expected: true, actual: false, passed: false, category: 'matching' }];
    }

    const expected: TestAssertions = JSON.parse(fs.readFileSync(assertionsPath, 'utf-8'));
    const results: AssertionResult[] = [];

    const pos = await this.prisma.purchaseOrder.findMany({
      where: { companyId },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    });

    const matches = await this.prisma.threeWayMatch.findMany({
      where: { OR: [{ purchaseOrder: { companyId } }, { deliveryNotes: { some: { companyId } } }] },
      include: {
        purchaseOrder: { include: { lineItems: { orderBy: { sortOrder: 'asc' } } } },
        deliveryNotes: { include: { lineItems: { orderBy: { sortOrder: 'asc' } } } },
        invoices: { include: { lineItems: { orderBy: { sortOrder: 'asc' } } } },
      },
    });

    if (expected.lineItems) {
      results.push(...this.evaluateLineItems(expected.lineItems, pos, matches));
    }

    if (expected.match) {
      results.push(...await this.evaluateMatchAssertions(expected.match, companyId, pos, matches));
    }

    return results;
  }

  private evaluateLineItems(expectedItems: TestAssertions['lineItems'], pos: any[], matches: any[]): AssertionResult[] {
    const results: AssertionResult[] = [];

    for (const expectedItem of expectedItems!) {
      let found = false;
      for (const po of pos) {
        for (const lineItem of po.lineItems) {
          if (!lineItem.description?.trim().includes(expectedItem.description)) continue;

          found = true;
          const match = matches.find((m) => m.purchaseOrderId === po.id);
          const pairings = (match?.lineItemPairings as any[]) || [];
          const actual = buildLineItem(po, lineItem, match, pairings);

          results.push(
            { name: `${expectedItem.description} — orderedQty`, expected: expectedItem.orderedQty, actual: actual.orderedQty, passed: actual.orderedQty === expectedItem.orderedQty, category: 'quantity' },
            { name: `${expectedItem.description} — receivedQty`, expected: expectedItem.receivedQty, actual: actual.receivedQty, passed: actual.receivedQty === expectedItem.receivedQty, category: 'quantity' },
            { name: `${expectedItem.description} — deliveryStatus`, expected: expectedItem.deliveryStatus, actual: actual.deliveryStatus, passed: actual.deliveryStatus === expectedItem.deliveryStatus, category: 'status' },
          );

          if (expectedItem.invoicedStatus) {
            results.push({ name: `${expectedItem.description} — invoicedStatus`, expected: expectedItem.invoicedStatus, actual: actual.invoicedStatus, passed: actual.invoicedStatus === expectedItem.invoicedStatus, category: 'status' });
          }
          if (expectedItem.invoicedAmount != null) {
            results.push({ name: `${expectedItem.description} — invoicedAmount`, expected: expectedItem.invoicedAmount, actual: actual.invoicedAmount, passed: actual.invoicedAmount === expectedItem.invoicedAmount, category: 'amount' });
          }
          break;
        }
        if (found) break;
      }

      if (!found) {
        results.push({ name: `${expectedItem.description} — found in results`, expected: true, actual: false, passed: false, category: 'matching' });
      }
    }

    return results;
  }

  private async evaluateMatchAssertions(
    expectedMatch: NonNullable<TestAssertions['match']>,
    companyId: string,
    pos: any[],
    matches: any[],
  ): Promise<AssertionResult[]> {
    const [dns, invoices] = await Promise.all([
      this.prisma.deliveryNote.findMany({ where: { companyId } }),
      this.prisma.invoice.findMany({ where: { companyId } }),
    ]);

    const hasDisc = matches.some((m) => ((m.discrepancies as any[]) || []).length > 0);

    return [
      { name: 'PO count', expected: expectedMatch.documentCount.pos, actual: pos.length, passed: pos.length === expectedMatch.documentCount.pos, category: 'matching' },
      { name: 'DN count', expected: expectedMatch.documentCount.dns, actual: dns.length, passed: dns.length === expectedMatch.documentCount.dns, category: 'matching' },
      { name: 'Invoice count', expected: expectedMatch.documentCount.invoices, actual: invoices.length, passed: invoices.length === expectedMatch.documentCount.invoices, category: 'matching' },
      { name: 'Has discrepancies', expected: expectedMatch.hasDiscrepancies, actual: hasDisc, passed: hasDisc === expectedMatch.hasDiscrepancies, category: 'matching' },
    ];
  }

  private async cleanupTestCompany(companyId: string): Promise<void> {
    try {
      await this.prisma.lineItemAuditLog.deleteMany({
        where: { poLineItem: { purchaseOrder: { companyId } } },
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
