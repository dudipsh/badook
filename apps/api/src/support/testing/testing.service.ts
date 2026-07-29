import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type {
  TestCaseMeta,
  TestCaseSummary,
  TestRunResult,
} from './testing.types';

@Injectable()
export class TestingService {
  private readonly logger = new Logger(TestingService.name);
  private readonly fixturesRoot: string;
  private readonly resultsDir: string;

  constructor() {
    this.fixturesRoot = path.resolve(
      process.cwd(),
      'test-fixtures/chains',
    );
    this.resultsDir = path.resolve(
      process.cwd(),
      'test-fixtures/results',
    );
  }

  listCases(): TestCaseSummary[] {
    if (!fs.existsSync(this.fixturesRoot)) return [];

    const dirs = fs.readdirSync(this.fixturesRoot, {
      withFileTypes: true,
    });

    return dirs
      .filter((d) => d.isDirectory())
      .map((d) => {
        const metaPath = path.join(
          this.fixturesRoot,
          d.name,
          'meta.json',
        );
        if (!fs.existsSync(metaPath)) return null;

        const meta: TestCaseMeta = JSON.parse(
          fs.readFileSync(metaPath, 'utf-8'),
        );

        // Check actual mock files
        const mocksDir = path.join(this.fixturesRoot, d.name, 'mocks');
        const hasMocks =
          fs.existsSync(mocksDir) &&
          fs.readdirSync(mocksDir).some((f) => f.endsWith('.json'));

        // Count real documents
        const docsDir = path.join(
          this.fixturesRoot,
          d.name,
          'documents',
        );
        const documentCount = fs.existsSync(docsDir)
          ? fs.readdirSync(docsDir).filter(
              (f) =>
                f.endsWith('.pdf') ||
                f.endsWith('.png') ||
                f.endsWith('.jpg') ||
                f.endsWith('.jpeg'),
            ).length
          : 0;

        const lastRun = this.getLastRunForCase(meta.id);

        return {
          id: meta.id,
          name: meta.name,
          description: meta.description,
          tags: meta.tags,
          hasMocks,
          documentCount,
          lastRun: lastRun
            ? {
                status: lastRun.status,
                mode: lastRun.mode,
                completedAt: lastRun.completedAt,
                passedCount: lastRun.assertions.filter((a) => a.passed)
                  .length,
                failedCount: lastRun.assertions.filter((a) => !a.passed)
                  .length,
              }
            : undefined,
        } satisfies TestCaseSummary;
      })
      .filter(Boolean) as TestCaseSummary[];
  }

  getCase(id: string): (TestCaseMeta & { hasMocks: boolean; documentCount: number }) | null {
    const metaPath = path.join(this.fixturesRoot, id, 'meta.json');
    if (!fs.existsSync(metaPath)) return null;

    const meta: TestCaseMeta = JSON.parse(
      fs.readFileSync(metaPath, 'utf-8'),
    );

    const mocksDir = path.join(this.fixturesRoot, id, 'mocks');
    const hasMocks =
      fs.existsSync(mocksDir) &&
      fs.readdirSync(mocksDir).some((f) => f.endsWith('.json'));

    const docsDir = path.join(this.fixturesRoot, id, 'documents');
    const documentCount = fs.existsSync(docsDir)
      ? fs.readdirSync(docsDir).filter(
          (f) =>
            f.endsWith('.pdf') ||
            f.endsWith('.png') ||
            f.endsWith('.jpg') ||
            f.endsWith('.jpeg'),
        ).length
      : 0;

    return { ...meta, hasMocks, documentCount };
  }

  getCasePath(id: string): string {
    return path.join(this.fixturesRoot, id);
  }

  saveResult(result: TestRunResult): void {
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }

    const fileName = `${result.completedAt.replace(/[:.]/g, '-')}_${result.caseId}.json`;
    fs.writeFileSync(
      path.join(this.resultsDir, fileName),
      JSON.stringify(result, null, 2),
      'utf-8',
    );
  }

  getResults(limit = 50): TestRunResult[] {
    if (!fs.existsSync(this.resultsDir)) return [];

    return fs
      .readdirSync(this.resultsDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit)
      .map((f) =>
        JSON.parse(
          fs.readFileSync(path.join(this.resultsDir, f), 'utf-8'),
        ),
      );
  }

  private getLastRunForCase(caseId: string): TestRunResult | null {
    if (!fs.existsSync(this.resultsDir)) return null;

    const files = fs
      .readdirSync(this.resultsDir)
      .filter((f) => f.endsWith('.json') && f.includes(caseId))
      .sort()
      .reverse();

    if (files.length === 0) return null;

    return JSON.parse(
      fs.readFileSync(
        path.join(this.resultsDir, files[0]),
        'utf-8',
      ),
    );
  }

  updateMeta(
    id: string,
    updates: Partial<TestCaseMeta>,
  ): void {
    const metaPath = path.join(this.fixturesRoot, id, 'meta.json');
    if (!fs.existsSync(metaPath)) return;

    const meta: TestCaseMeta = JSON.parse(
      fs.readFileSync(metaPath, 'utf-8'),
    );
    Object.assign(meta, updates);
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }
}
