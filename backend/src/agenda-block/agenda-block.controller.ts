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
import { AgendaBlockService } from './agenda-block.service';
import { CreateAgendaBlockDto } from './dto/create-agenda-block.dto';
import { UpdateAgendaBlockDto } from './dto/update-agenda-block.dto';
import { QueryAgendaBlockDto } from './dto/query-agenda-block.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';

@RequireFeature('AGENDA')
@ApiBearerAuth()
@ApiTags('Agenda Blocks')
@Controller('agenda-blocks')
export class AgendaBlockController {
  constructor(private readonly agendaBlockService: AgendaBlockService) {}

  @Post()
  @ApiOperation({ summary: 'Criar bloqueio de agenda' })
  @ApiResponse({ status: 201, description: 'Bloqueio criado' })
  @ApiResponse({ status: 409, description: 'Conflito de horário' })
  @ApiResponse({ status: 403, description: 'Profissional só pode bloquear a própria agenda' })
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAgendaBlockDto,
  ) {
    return this.agendaBlockService.create(orgId, user.sub, user.role, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar bloqueios de agenda por intervalo de datas' })
  findAll(@OrgId() orgId: string, @Query() query: QueryAgendaBlockDto) {
    return this.agendaBlockService.findAll(orgId, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar bloqueio de agenda' })
  update(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAgendaBlockDto,
  ) {
    return this.agendaBlockService.update(orgId, user.sub, user.role, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover bloqueio de agenda' })
  remove(@OrgId() orgId: string, @CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agendaBlockService.remove(orgId, user.sub, user.role, id);
  }
}
