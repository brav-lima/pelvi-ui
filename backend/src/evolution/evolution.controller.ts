import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EvolutionService } from './evolution.service';
import { CreateEvolutionDto } from './dto/create-evolution.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiBearerAuth()
@ApiTags('Evolutions')
@Throttle({ default: { ttl: 60000, limit: 30 } })
@Controller('evolutions')
export class EvolutionController {
  constructor(private readonly evolutionService: EvolutionService) {}

  @Post()
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEvolutionDto,
  ) {
    return this.evolutionService.create(orgId, user.sub, dto);
  }

  @Get()
  findByPatient(
    @OrgId() orgId: string,
    @Query('patientId') patientId: string,
  ) {
    return this.evolutionService.findByPatient(orgId, patientId);
  }

  @Get(':id')
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.evolutionService.findById(orgId, id);
  }
}
