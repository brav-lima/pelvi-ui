import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ProcedureService } from './procedure.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';
import { OrgId } from '../auth/decorators/org-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiBearerAuth()
@ApiTags('Procedures')
@Controller('procedures')
export class ProcedureController {
  constructor(private readonly procedureService: ProcedureService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@OrgId() orgId: string, @Body() dto: CreateProcedureDto) {
    return this.procedureService.create(orgId, dto);
  }

  @Get()
  findAll(@OrgId() orgId: string) {
    return this.procedureService.findAll(orgId);
  }

  @Get(':id')
  findById(@OrgId() orgId: string, @Param('id') id: string) {
    return this.procedureService.findById(orgId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @OrgId() orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProcedureDto,
  ) {
    return this.procedureService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.procedureService.remove(orgId, id);
  }
}
