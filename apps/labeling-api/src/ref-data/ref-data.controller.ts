import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/auth.guard';
import { RefDataService } from './ref-data.service';
import {
  PaginationDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateProductDto,
  UpdateProductDto,
  CreateCityDto,
  UpdateCityDto,
} from './dto/ref-data.dto';

@Controller('ref-data')
@UseGuards(ApiKeyGuard)
export class RefDataController {
  constructor(private readonly refDataService: RefDataService) {}

  // ─── Stats ───

  @Get('stats')
  stats() {
    return this.refDataService.stats();
  }

  // ─── Suppliers ───

  @Get('suppliers')
  listSuppliers(@Query() query: PaginationDto) {
    return this.refDataService.listSuppliers(query);
  }

  @Get('suppliers/categories')
  supplierCategories() {
    return this.refDataService.supplierCategories();
  }

  @Post('suppliers')
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.refDataService.createSupplier(dto);
  }

  @Patch('suppliers/:id')
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.refDataService.updateSupplier(id, dto);
  }

  @Delete('suppliers/:id')
  deleteSupplier(@Param('id') id: string) {
    return this.refDataService.deleteSupplier(id);
  }

  // ─── Products ───

  @Get('products')
  listProducts(@Query() query: PaginationDto) {
    return this.refDataService.listProducts(query);
  }

  @Get('products/categories')
  productCategories() {
    return this.refDataService.productCategories();
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.refDataService.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.refDataService.updateProduct(id, dto);
  }

  @Delete('products/by-categories')
  deleteProductsByCategories(@Body() body: { categories: string[] }) {
    return this.refDataService.deleteProductsByCategories(body.categories);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.refDataService.deleteProduct(id);
  }

  // ─── Cities ───

  @Get('cities')
  listCities(@Query() query: PaginationDto) {
    return this.refDataService.listCities(query);
  }

  @Get('cities/districts')
  cityDistricts() {
    return this.refDataService.cityDistricts();
  }

  @Post('cities')
  createCity(@Body() dto: CreateCityDto) {
    return this.refDataService.createCity(dto);
  }

  @Patch('cities/:id')
  updateCity(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.refDataService.updateCity(id, dto);
  }

  @Delete('cities/:id')
  deleteCity(@Param('id') id: string) {
    return this.refDataService.deleteCity(id);
  }

  // ─── Seed (bulk import) ───

  @Post('seed/suppliers')
  seedSuppliers(@Body() data: CreateSupplierDto[]) {
    return this.refDataService.seedSuppliers(data);
  }

  @Post('seed/products')
  seedProducts(@Body() data: CreateProductDto[]) {
    return this.refDataService.seedProducts(data);
  }

  @Post('seed/cities')
  seedCities(@Body() data: object[]) {
    return this.refDataService.seedCities(data as any);
  }

  // ─── Migration ───

  @Post('migrate/suppliers-from-samples')
  migrateSuppliersFromSamples() {
    return this.refDataService.migrateSuppliersFromSamples();
  }

  @Post('migrate/products-from-samples')
  migrateProductsFromSamples() {
    return this.refDataService.migrateProductsFromSamples();
  }
}
