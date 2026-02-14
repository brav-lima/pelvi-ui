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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PatientService } from './patient.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientDto } from './dto/query-patient.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';

@ApiBearerAuth()
@ApiTags('Patients')
@Controller('patients')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastrar paciente na clínica' })
  @ApiResponse({ status: 201, description: 'Paciente criado' })
  create(@OrgId() orgId: string, @Body() dto: CreatePatientDto) {
    return this.patientService.create(orgId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar pacientes (paginado, com busca)',
    description: 'Busca por nome ou CPF. Escopo por organizationId do token.',
  })
  findAll(@OrgId() orgId: string, @Query() query: QueryPatientDto) {
    return this.patientService.findAll(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar paciente por ID' })
  @ApiResponse({ status: 404, description: 'Paciente não encontrado' })
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.patientService.findById(orgId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar dados do paciente' })
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientService.update(orgId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover paciente' })
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.patientService.remove(orgId, id);
  }
}
