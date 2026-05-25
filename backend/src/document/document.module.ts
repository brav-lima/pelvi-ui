import { Module } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { TemplateRendererService } from './template-renderer.service';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { DOCUMENT_STORAGE } from './storage/document-storage.token';

@Module({
  controllers: [DocumentController],
  providers: [
    DocumentService,
    TemplateRendererService,
    {
      provide: DOCUMENT_STORAGE,
      useClass: LocalStorageAdapter,
      // Phase 3: trocar por R2StorageAdapter via env var:
      // useFactory: (config: ConfigService) =>
      //   config.get('STORAGE_DRIVER') === 'r2' ? new R2StorageAdapter(config) : new LocalStorageAdapter(config),
      // inject: [ConfigService],
    },
  ],
  exports: [TemplateRendererService],
})
export class DocumentModule {}
