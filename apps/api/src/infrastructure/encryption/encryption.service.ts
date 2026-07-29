import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly saltLength = 16;
  private readonly tagLength = 16;
  private readonly ivLength = 12;

  constructor() {
    if (!process.env.ENCRYPTION_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          'ENCRYPTION_KEY is required in production — it protects stored OAuth refresh tokens. ' +
            'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
        );
      }
      this.logger.warn(
        'ENCRYPTION_KEY not set. Falling back to a publicly-known development key — ' +
          'never run this way outside local development.',
      );
    }
  }

  private getMasterKey(): Buffer {
    const masterKey = process.env.ENCRYPTION_KEY;
    if (!masterKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY is required in production');
      }
      return crypto.scryptSync('dev-fallback-key', 'salt', 32);
    }
    if (masterKey.length !== 64) {
      throw new Error(
        'ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      );
    }
    return Buffer.from(masterKey, 'hex');
  }

  encrypt(plaintext: Record<string, any>): string {
    try {
      const masterKey = this.getMasterKey();
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, masterKey, iv);
      const plainJSON = JSON.stringify(plaintext);
      const encrypted = Buffer.concat([
        cipher.update(plainJSON, 'utf8'),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      const result = Buffer.concat([iv, authTag, encrypted]);
      return result.toString('base64');
    } catch (error) {
      this.logger.error('Encryption failed', error);
      throw error;
    }
  }

  decrypt(ciphertext: string): Record<string, any> {
    try {
      const masterKey = this.getMasterKey();
      const buffer = Buffer.from(ciphertext, 'base64');
      const iv = buffer.subarray(0, this.ivLength);
      const authTag = buffer.subarray(this.ivLength, this.ivLength + this.tagLength);
      const encrypted = buffer.subarray(this.ivLength + this.tagLength);
      const decipher = crypto.createDecipheriv(this.algorithm, masterKey, iv);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plaintext);
    } catch (error) {
      this.logger.error('Decryption failed', error);
      throw error;
    }
  }
}
