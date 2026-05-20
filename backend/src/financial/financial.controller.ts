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
import { FinancialService } from './financial.service';
import { CreateFinancialDto } from './dto/create-financial.dto';
import { UpdateFinancialDto } from './dto/update-financial.dto';
import { QueryFinancialDto } from './dto/query-financial.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';

@RequireFeature('FINANCIAL_BASIC')
@ApiBearerAuth()
@ApiTags('Financial')
@Controller('financial')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Criar registro financeiro (entrada ou saída)' })
  create(@OrgId() orgId: string, @Body() dto: CreateFinancialDto) {
    return this.financialService.create(orgId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar registros financeiros do mês',
    description: 'Filtro obrigatório por month e year.',
  })
  findAll(@OrgId() orgId: string, @Query() query: QueryFinancialDto) {
    return this.financialService.findAll(orgId, query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Resumo financeiro mensal',
    description: 'Retorna totalReceived, totalPending, totalExpenses e balance.',
  })
  summary(@OrgId() orgId: string, @Query() query: QueryFinancialDto) {
    return this.financialService.summary(orgId, query);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Listar registros financeiros por paciente' })
  findByPatient(@OrgId() orgId: string, @Param('patientId') patientId: string) {
    return this.financialService.findByPatient(orgId, patientId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar registro financeiro por ID' })
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.financialService.findById(orgId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Atualizar registro financeiro' })
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialDto,
  ) {
    return this.financialService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Remover registro financeiro' })
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.financialService.remove(orgId, id);
  }
}
