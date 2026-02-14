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
import { AppointmentService } from './appointment.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { QueryAppointmentDto } from './dto/query-appointment.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiBearerAuth()
@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar agendamento',
    description:
      'Calcula end_at automaticamente pela duração do procedimento. ' +
      'Valida conflito de horário por profissional.',
  })
  @ApiResponse({ status: 201, description: 'Agendamento criado' })
  @ApiResponse({ status: 409, description: 'Conflito de horário' })
  @ApiResponse({ status: 404, description: 'Procedimento não encontrado' })
  create(@OrgId() orgId: string, @Body() dto: CreateAppointmentDto) {
    return this.appointmentService.create(orgId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar agenda',
    description:
      'Filtro obrigatório por intervalo de datas (startDate, endDate). ' +
      'Filtro opcional por professionalId. Ordenado por start_at.',
  })
  findAll(@OrgId() orgId: string, @Query() query: QueryAppointmentDto) {
    return this.appointmentService.findAll(orgId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar agendamento por ID' })
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.appointmentService.findById(orgId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar agendamento' })
  @ApiResponse({ status: 409, description: 'Conflito de horário' })
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.appointmentService.update(orgId, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Alterar status do agendamento',
    description: 'Status possíveis: SCHEDULED, CONFIRMED, CANCELED, DONE.',
  })
  updateStatus(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.appointmentService.updateStatus(
      orgId,
      id,
      dto.status,
      user.sub,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover agendamento' })
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.appointmentService.remove(orgId, id);
  }
}
