import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly uploadDir: string;
  private readonly useS3: boolean;

  constructor(private readonly config: ConfigService) {
    const bucket = this.config.get<string>('s3.bucket');
    const accessKeyId = this.config.get<string>('s3.accessKeyId');
    const secretAccessKey = this.config.get<string>('s3.secretAccessKey');
    const region = this.config.get<string>('s3.region') || 'eu-north-1';
    this.uploadDir = this.config.get('upload.dir') || './uploads';
    this.bucket = bucket || '';

    if (bucket && accessKeyId && secretAccessKey) {
      this.s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.useS3 = true;
      this.logger.log(`S3 storage enabled: bucket=${bucket}, region=${region}`);
    } else {
      this.s3 = null;
      this.useS3 = false;
      this.logger.warn('S3 not configured, using local disk storage');
    }
  }

  async upload(
    buffer: Buffer,
    fileName: string,
    companyId: string,
  ): Promise<string> {
    const key = `companies/${companyId}/documents/${Date.now()}-${fileName}`;

    if (this.useS3 && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: this.getContentType(fileName),
        }),
      );
      this.logger.log(`Uploaded to S3: ${key}`);
      return key;
    }

    // Local fallback
    await fs.mkdir(this.uploadDir, { recursive: true });
    const localPath = path.join(this.uploadDir, `${Date.now()}-${fileName}`);
    await fs.writeFile(localPath, buffer);
    this.logger.log(`Saved locally: ${localPath}`);
    return localPath;
  }

  async getSignedUrl(key: string, expiresIn = 900): Promise<string> {
    if (!this.isS3Key(key) || !this.s3) {
      throw new Error(`Cannot get signed URL for local path: ${key}`);
    }
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  async exists(key: string): Promise<boolean> {
    if (this.isS3Key(key) && this.s3) {
      try {
        await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
        return true;
      } catch {
        return false;
      }
    }
    try {
      await fs.access(this.resolveLocalPath(key));
      return true;
    } catch {
      return false;
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    if (this.isS3Key(key) && this.s3) {
      const response = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return Buffer.from(await response.Body!.transformToByteArray());
    }

    // Local / legacy path
    const resolved = this.resolveLocalPath(key);
    return fs.readFile(resolved);
  }

  async delete(key: string): Promise<void> {
    if (this.isS3Key(key) && this.s3) {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.log(`Deleted from S3: ${key}`);
      return;
    }

    // Local / legacy
    const resolved = this.resolveLocalPath(key);
    try {
      await fs.unlink(resolved);
      this.logger.log(`Deleted locally: ${resolved}`);
    } catch {
      // File may not exist
    }
  }

  /** Delete all S3 objects under companies/{companyId}/documents/ */
  async deleteCompanyFiles(companyId: string): Promise<number> {
    const prefix = `companies/${companyId}/documents/`;

    if (!this.useS3 || !this.s3) {
      this.logger.warn('S3 not configured, skipping S3 cleanup');
      return 0;
    }

    let deleted = 0;
    let continuationToken: string | undefined;

    do {
      const list = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const keys = (list.Contents || []).map((obj) => ({ Key: obj.Key! }));
      if (keys.length > 0) {
        await this.s3.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: keys },
          }),
        );
        deleted += keys.length;
      }

      continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (continuationToken);

    this.logger.log(`Deleted ${deleted} S3 objects for company ${companyId}`);
    return deleted;
  }

  /** Upload a buffer to S3 with a specific key (or save locally if S3 not configured) */
  async uploadWithKey(buffer: Buffer, key: string): Promise<string> {
    if (this.useS3 && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: this.getContentType(key),
        }),
      );
      this.logger.log(`Uploaded to S3: ${key}`);
      return key;
    }

    // Local fallback
    const localPath = path.join(this.uploadDir, path.basename(key));
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buffer);
    return localPath;
  }

  isS3Key(filePath: string): boolean {
    return filePath.startsWith('companies/');
  }

  private resolveLocalPath(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath;
    const cwdPath = path.resolve(filePath);
    return cwdPath;
  }

  private getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.pdf':
        return 'application/pdf';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  }
}
