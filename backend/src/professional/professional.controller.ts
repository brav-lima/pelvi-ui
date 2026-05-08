import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProfessionalService } from './professional.service';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiBearerAuth()
@ApiTags('Professionals')
@Controller('professionals')
export class ProfessionalController {
  constructor(private readonly professionalService: ProfessionalService) {}

  @Get()
  findAll(@OrgId() orgId: string) {
    return this.professionalService.findAll(orgId);
  }

  @Get(':id')
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.professionalService.findById(orgId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalDto,
  ) {
    return this.professionalService.update(orgId, id, dto);
  }
}
