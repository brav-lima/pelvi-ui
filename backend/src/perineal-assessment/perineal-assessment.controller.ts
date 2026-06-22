import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PerinealAssessmentService } from './perineal-assessment.service';
import { CreatePerinealAssessmentDto } from './dto/create-perineal-assessment.dto';
import { UpdatePerinealAssessmentDto } from './dto/update-perineal-assessment.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';
import { RequireFeature } from '../subscription/decorators/require-feature.decorator';

@RequireFeature('PERINEAL_ASSESSMENT')
@ApiBearerAuth()
@ApiTags('Perineal Assessments')
@Throttle({ default: { ttl: 60000, limit: 30 } })
@Controller('perineal-assessments')
export class PerinealAssessmentController {
  constructor(
    private readonly perinealAssessmentService: PerinealAssessmentService,
  ) {}

  @Post()
  create(
    @OrgId() orgId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePerinealAssessmentDto,
  ) {
    return this.perinealAssessmentService.create(orgId, user.sub, dto);
  }

  @Get()
  findByPatient(
    @OrgId() orgId: string,
    @Query('patientId') patientId: string,
  ) {
    return this.perinealAssessmentService.findByPatient(orgId, patientId);
  }

  @Get(':id')
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.perinealAssessmentService.findById(orgId, id);
  }

  @Patch(':id')
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePerinealAssessmentDto,
  ) {
    return this.perinealAssessmentService.update(orgId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.perinealAssessmentService.remove(orgId, id);
  }
}
