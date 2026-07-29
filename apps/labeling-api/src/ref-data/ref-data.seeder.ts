import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RefDataService } from './ref-data.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RefDataSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(RefDataSeeder.name);

  constructor(private readonly refDataService: RefDataService) {}

  async onApplicationBootstrap() {
    try {
      const stats = await this.refDataService.stats();
      const isEmpty = stats.suppliers === 0 && stats.products === 0 && stats.cities === 0;

      if (!isEmpty) {
        this.logger.log(
          `Ref data already populated: ${stats.suppliers} suppliers, ${stats.products} products, ${stats.cities} cities`,
        );
        return;
      }

      this.logger.log('Ref data tables are empty — running auto-seed...');

      // 1. Migrate suppliers & products from existing training samples
      const supplierMigration = await this.refDataService.migrateSuppliersFromSamples();
      this.logger.log(
        `Migrated suppliers from samples: ${supplierMigration.created} created, ${supplierMigration.updated} updated`,
      );

      const productMigration = await this.refDataService.migrateProductsFromSamples();
      this.logger.log(
        `Migrated products from samples: ${productMigration.created} created, ${productMigration.updated} updated`,
      );

      // 2. Load seed data from JSON files
      const seedDir = path.resolve(__dirname, '../../scripts/seed-data/output');
      await this.loadSeedFile(seedDir, 'suppliers.json', 'suppliers');
      await this.loadSeedFile(seedDir, 'construction-products.json', 'products');
      await this.loadSeedFile(seedDir, 'cities.json', 'cities');

      const finalStats = await this.refDataService.stats();
      this.logger.log(
        `Auto-seed complete: ${finalStats.suppliers} suppliers, ${finalStats.products} products, ${finalStats.cities} cities`,
      );
    } catch (e) {
      this.logger.error(`Auto-seed failed: ${e}`);
    }
  }

  private async loadSeedFile(seedDir: string, fileName: string, type: 'suppliers' | 'products' | 'cities') {
    const filePath = path.join(seedDir, fileName);
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`Seed file not found: ${filePath}`);
      return;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    let result: { created: number; skipped: number; total: number };
    switch (type) {
      case 'suppliers':
        result = await this.refDataService.seedSuppliers(data);
        break;
      case 'products':
        result = await this.refDataService.seedProducts(data);
        break;
      case 'cities':
        result = await this.refDataService.seedCities(data);
        break;
    }

    this.logger.log(`Seeded ${type}: ${result.created} created, ${result.skipped} skipped (total: ${result.total})`);
  }
}
