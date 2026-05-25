// Phase 3 stub — implement with @aws-sdk/client-s3 pointing to R2 endpoint
// Toggle via STORAGE_DRIVER=r2 env var in DocumentModule provider factory
import type { Readable } from 'stream';
import type { IDocumentStorage, UploadResult } from './document-storage.interface';

export class R2StorageAdapter implements IDocumentStorage {
  upload(_orgId: string, _buffer: Buffer, _mimeType: string): Promise<UploadResult> {
    throw new Error('R2StorageAdapter not implemented');
  }

  getStream(_fileKey: string): Promise<Readable> {
    throw new Error('R2StorageAdapter not implemented');
  }

  delete(_fileKey: string): Promise<void> {
    throw new Error('R2StorageAdapter not implemented');
  }
}
