import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import type { IDocumentStorage, UploadResult } from './document-storage.interface';

@Injectable()
export class LocalStorageAdapter implements IDocumentStorage {
  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = config.get('STORAGE_LOCAL_PATH', '/app/uploads');
  }

  async upload(orgId: string, buffer: Buffer, mimeType: string): Promise<UploadResult> {
    const ext = mimeType === 'application/pdf' ? '.pdf' : '.bin';
    const fileKey = `${orgId}/${randomUUID()}${ext}`;
    const fullPath = path.join(this.baseDir, fileKey);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);

    this.logger.log({ msg: 'file_uploaded', fileKey, size: buffer.length });
    return { fileKey, fileSize: buffer.length, mimeType };
  }

  async getStream(fileKey: string): Promise<Readable> {
    const fullPath = path.join(this.baseDir, fileKey);
    // Verificação explícita antes de criar o stream — melhor 404 que stream vazio
    await fs.access(fullPath);
    return fsSync.createReadStream(fullPath);
  }

  async delete(fileKey: string): Promise<void> {
    const fullPath = path.join(this.baseDir, fileKey);
    await fs.unlink(fullPath).catch((err: NodeJS.ErrnoException) => {
      this.logger.warn({ msg: 'file_not_found_on_delete', fileKey, err: err.message });
    });
  }
}
