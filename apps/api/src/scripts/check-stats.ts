/**
 * Quick script to check project stats (match rate) without auth.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProjectStatsService } from '../domain/projects/project-stats.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { VendorLineItemsService } from '../domain/projects/vendor-line-items.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const prisma = app.get(PrismaService);
  const statsService = app.get(ProjectStatsService);
  const vendorLineItems = app.get(VendorLineItemsService);

  const project = await prisma.project.findFirst();
  if (!project) { console.log('No project found'); process.exit(1); }

  console.log(`Project: ${project.name} (${project.id})`);

  const stats = await statsService.getProjectStats(project.id);
  console.log('\nProject Stats:');
  console.log(JSON.stringify(stats, null, 2));

  // Also dump vendor line items for detail
  const vendors = await statsService.getProjectVendors(project.id);
  for (const vendor of vendors) {
    console.log(`\nVendor: ${vendor.name} (${vendor.id})`);
    const items = await vendorLineItems.getVendorLineItems(project.id, vendor.id, {});
    for (const item of items) {
      const matchPct = item.orderedQty > 0 ? Math.round((Math.min(item.receivedQty || 0, item.orderedQty) / item.orderedQty) * 100) : 0;
      console.log(`  [${matchPct}%] ${item.description?.substring(0, 40)} | ordered=${item.orderedQty} received=${item.receivedQty} | isService=${item.isService}`);
    }
  }

  await app.close();
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
