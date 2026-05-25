import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseEnumPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { GeneratedDocumentTemplate } from '@prisma/client';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { DocumentService } from './document.service';
import { TemplateRendererService } from './template-renderer.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { AVAILABLE_TEMPLATES } from './constants/available-templates';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiBearerAuth()
@ApiTags('Documents')
@Controller('documents')
export class DocumentController {
  constructor(
    private readonly documentService: DocumentService,
    private readonly templateRenderer: TemplateRendererService,
  ) {}

  // ── Documentos base (FILE) — protegidos por DOCUMENTS ────────────────

  @RequireFeature('DOCUMENTS')
  @Get()
  findAll(@OrgId() orgId: string) {
    return this.documentService.findAll(orgId);
  }

  @RequireFeature('DOCUMENTS')
  @Get('templates')
  listTemplates() {
    return AVAILABLE_TEMPLATES;
  }

  @RequireFeature('DOCUMENTS')
  @Post('upload')
  @Roles('ADMIN')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Arquivo PDF + metadados' })
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, file.mimetype === 'application/pdf');
      },
    }),
  )
  upload(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentService.upload(orgId, user.sub, file, dto);
  }

  @RequireFeature('DOCUMENTS')
  @Get(':id/download')
  download(@OrgId() orgId: string, @Param('id') id: string) {
    return this.documentService.download(orgId, id);
  }

  @RequireFeature('DOCUMENTS')
  @Patch(':id')
  @Roles('ADMIN')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentService.update(orgId, id, dto);
  }

  @RequireFeature('DOCUMENTS')
  @Delete(':id')
  @Roles('ADMIN')
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.documentService.softDelete(orgId, id);
  }

  // ── Documentos gerados (GENERATED) — autorização fica na tela de origem ──

  @Post('generate/:template')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  generate(
    @OrgId() orgId: string,
    @Param('template', new ParseEnumPipe(GeneratedDocumentTemplate))
    template: GeneratedDocumentTemplate,
    @Body() dto: GenerateDocumentDto,
  ) {
    return this.templateRenderer.render(orgId, template, dto.context);
  }
}
