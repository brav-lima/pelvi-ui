import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { TreatmentPackageService } from './treatment-package.service';
import { CreateTreatmentPackageDto } from './dto/create-treatment-package.dto';
import { UpdateTreatmentPackageDto } from './dto/update-treatment-package.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';

@RequireFeature('TREATMENT_PACKAGES')
@ApiBearerAuth()
@ApiTags('Treatment Packages')
@Controller('treatment-packages')
export class TreatmentPackageController {
  constructor(private readonly service: TreatmentPackageService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Criar pacote de tratamento' })
  create(@OrgId() orgId: string, @Body() dto: CreateTreatmentPackageDto) {
    return this.service.create(orgId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar pacotes de tratamento' })
  findAll(
    @OrgId() orgId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.service.findAll(orgId, patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar pacote de tratamento por ID' })
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.service.findById(orgId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualizar pacote de tratamento' })
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTreatmentPackageDto,
  ) {
    return this.service.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remover pacote de tratamento' })
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.service.remove(orgId, id);
  }
}
