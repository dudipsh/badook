/**
 * Debug script: runs the full document pipeline directly (no BullMQ)
 * and logs extraction results at each step.
 *
 * Usage: npx tsx src/scripts/debug-pipeline.ts <s3-file-path>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AgentOrchestratorService } from '../intelligence/agents/agent-orchestrator.service';

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx src/scripts/debug-pipeline.ts <s3-file-path>');
    process.exit(1);
  }

  console.log('Bootstrapping NestJS app...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const orchestrator = app.get(AgentOrchestratorService);
  const companyId = process.env.DEBUG_COMPANY_ID;
  if (!companyId) throw new Error('Set DEBUG_COMPANY_ID to the company to debug');

  console.log(`\nProcessing file: ${filePath}`);
  console.log('='.repeat(60));

  try {
    const result = await orchestrator.processFile({
      companyId,
      filePath,
      source: 'MANUAL',
      originalFileName: filePath.split('/').pop() || 'test.pdf',
      force: true,
    });

    console.log('\n' + '='.repeat(60));
    console.log('PIPELINE RESULT:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Pipeline error:', err);
  }

  // Check the debug log
  const fs = await import('fs');
  if (fs.existsSync('/tmp/pipeline-debug.log')) {
    console.log('\n' + '='.repeat(60));
    console.log('PIPELINE DEBUG LOG:');
    console.log(fs.readFileSync('/tmp/pipeline-debug.log', 'utf-8'));
  } else {
    console.log('\nNo pipeline debug log was written!');
  }

  await app.close();
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
