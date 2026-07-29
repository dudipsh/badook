import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { StorageService } from '../../infrastructure/storage/storage.service';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadDir: string;
  private readonly thumbDir: string;

  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {
    this.uploadDir = this.config.get('upload.dir') || './uploads';
    this.thumbDir = path.join(this.uploadDir, '.thumbnails');
  }

  private cacheKey(filePath: string, page: number, suffix: string): string {
    const hash = crypto.createHash('md5').update(`${filePath}:${page}`).digest('hex');
    return path.join(this.thumbDir, `${hash}${suffix}`);
  }

  private async getBuffer(filePath: string): Promise<Buffer> {
    try {
      return await this.storage.getBuffer(filePath);
    } catch {
      throw new NotFoundException(`File not found: ${filePath}`);
    }
  }

  async getFileInfo(filePath: string): Promise<{ pageCount: number }> {
    const buffer = await this.getBuffer(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      const mupdf: any = await (Function('return import("mupdf")')());
      const m = mupdf.default || mupdf;
      const doc = m.Document.openDocument(buffer, 'application/pdf');
      return { pageCount: doc.countPages() };
    }

    return { pageCount: 1 };
  }

  async getThumbnail(filePath: string, page: number): Promise<Buffer> {
    const cachePath = this.cacheKey(filePath, page, '-thumb.jpg');

    try {
      return await fs.readFile(cachePath);
    } catch {
      // Not cached, generate
    }

    const pngBuffer = await this.renderPage(filePath, page);

    const sharp = (await import('sharp')).default;
    const thumbnail = await sharp(pngBuffer)
      .resize(200)
      .jpeg({ quality: 40 })
      .toBuffer();

    await fs.mkdir(this.thumbDir, { recursive: true });
    await fs.writeFile(cachePath, thumbnail);

    return thumbnail;
  }

  async getPage(filePath: string, page: number): Promise<Buffer> {
    const cachePath = this.cacheKey(filePath, page, '-full.png');

    try {
      return await fs.readFile(cachePath);
    } catch {
      // Not cached, generate
    }

    const pngBuffer = await this.renderPage(filePath, page);

    await fs.mkdir(this.thumbDir, { recursive: true });
    await fs.writeFile(cachePath, pngBuffer);

    return pngBuffer;
  }

  async getRawFile(filePath: string): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const buffer = await this.getBuffer(filePath);
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.pdf' ? 'application/pdf' : `image/${ext.slice(1)}`;
    return { buffer, filename, contentType };
  }

  private async renderPage(filePath: string, page: number): Promise<Buffer> {
    const buffer = await this.getBuffer(filePath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.pdf') {
      const mupdf: any = await (Function('return import("mupdf")')());
      const m = mupdf.default || mupdf;
      const doc = m.Document.openDocument(buffer, 'application/pdf');
      const pageCount = doc.countPages();

      if (page < 0 || page >= pageCount) {
        throw new NotFoundException(`Page ${page} out of range (0-${pageCount - 1})`);
      }

      const p = doc.loadPage(page);
      const matrix = m.Matrix.scale(2, 2);
      const pixmap = p.toPixmap(matrix, m.ColorSpace.DeviceRGB);
      return Buffer.from(pixmap.asPNG());
    }

    if (page !== 0) {
      throw new NotFoundException(`Image files only have page 0`);
    }
    return buffer;
  }
}
