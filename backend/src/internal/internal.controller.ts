import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'
import { InternalApiKeyGuard } from './guards/internal-api-key.guard'
import { InternalService } from './internal.service'
import { CreateClinicDto } from './dto/create-clinic.dto'
import { UpdateAccessDto } from './dto/update-access.dto'
import { CreateInternalPersonDto } from './dto/create-internal-person.dto'
import { LinkClinicUserDto } from './dto/link-clinic-user.dto'
import { UpdateClinicUserDto } from './dto/update-clinic-user.dto'
import { ResetClinicUserPasswordDto } from './dto/reset-clinic-user-password.dto'

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

  @Post('persons')
  upsertPerson(@Body() dto: CreateInternalPersonDto) {
    return this.internalService.upsertPerson(dto)
  }

  @Post('clinics/:clinicId/users')
  linkClinicUser(@Param('clinicId') clinicId: string, @Body() dto: LinkClinicUserDto) {
    return this.internalService.linkClinicUser(clinicId, dto)
  }

  @Get('clinics/:clinicId/users')
  listClinicUsers(@Param('clinicId') clinicId: string) {
    return this.internalService.listClinicUsers(clinicId)
  }

  @Patch('clinics/:clinicId/users/:organizationUserId')
  @HttpCode(200)
  updateClinicUser(
    @Param('clinicId') clinicId: string,
    @Param('organizationUserId') organizationUserId: string,
    @Body() dto: UpdateClinicUserDto,
  ) {
    return this.internalService.updateClinicUser(clinicId, organizationUserId, dto)
  }

  @Post('clinics/:clinicId/users/:organizationUserId/reset-password')
  @HttpCode(200)
  resetClinicUserPassword(
    @Param('clinicId') clinicId: string,
    @Param('organizationUserId') organizationUserId: string,
    @Body() dto: ResetClinicUserPasswordDto,
  ) {
    return this.internalService.resetClinicUserPassword(clinicId, organizationUserId, dto)
  }
}
