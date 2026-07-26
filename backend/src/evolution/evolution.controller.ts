import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EvolutionService } from './evolution.service';
import { CreateEvolutionDto } from './dto/create-evolution.dto';
import { UpdateEvolutionDto } from './dto/update-evolution.dto';
import { QueryEvolutionDto } from './dto/query-evolution.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';

@RequireFeature('EVOLUTIONS')
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
  findByPatient(@OrgId() orgId: string, @Query() query: QueryEvolutionDto) {
    return this.evolutionService.findByPatient(orgId, query.patientId);
  }

  @Get(':id')
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.evolutionService.findById(orgId, id);
  }

  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEvolutionDto,
  ) {
    return this.evolutionService.update(orgId, id, dto);
  }
}
