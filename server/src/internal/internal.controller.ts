import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'
import { InternalApiKeyGuard } from './guards/internal-api-key.guard'
import { InternalService } from './internal.service'
import { CreateClinicDto } from './dto/create-clinic.dto'
import { UpdateAccessDto } from './dto/update-access.dto'

@Controller('internal')
@Public()
@UseGuards(InternalApiKeyGuard)
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Get('clinics')
  listClinics() {
    return this.internalService.listClinics()
  }

  @Post('clinics')
  createClinic(@Body() dto: CreateClinicDto) {
    return this.internalService.createClinic(dto)
  }

  @Patch('clinics/:clinicId/access')
  @HttpCode(200)
  updateAccess(@Param('clinicId') clinicId: string, @Body() dto: UpdateAccessDto) {
    return this.internalService.updateClinicAccess(clinicId, dto.status, dto.maxUsers, dto.maxPatients)
  }
}
