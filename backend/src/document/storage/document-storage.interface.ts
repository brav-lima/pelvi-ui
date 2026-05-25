export interface UploadResult {
  fileKey: string;
  fileSize: number;
  mimeType: string;
}

import type { Readable } from 'stream';

export interface IDocumentStorage {
  upload(orgId: string, buffer: Buffer, mimeType: string): Promise<UploadResult>;
  getStream(fileKey: string): Promise<Readable>;
  delete(fileKey: string): Promise<void>;
}
