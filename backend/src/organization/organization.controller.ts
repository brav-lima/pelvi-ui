import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrgId } from '../auth/decorators/org-id.decorator';

@ApiBearerAuth()
@ApiTags('Organizations')
@Roles(Role.ADMIN)
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
  ) {}

  // ── Plan usage (deve vir antes de ':id' para evitar conflito de rota) ──

  @Get('me/plan')
  getPlanUsage(@OrgId() orgId: string) {
    return this.organizationService.getPlanUsage(orgId);
  }

  // ── Organization CRUD ──

  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(dto);
  }

  @Get()
  findAll() {
    return this.organizationService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.organizationService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.organizationService.remove(id);
  }

  // ── OrganizationUser (vínculos) ──

  @Post(':orgId/users')
  addUser(
    @OrgId() callerOrgId: string,
    @Param('orgId') orgId: string,
    @Body() dto: CreateOrganizationUserDto,
  ) {
    if (callerOrgId !== orgId) {
      throw new ForbiddenException('Você não pode gerenciar outra organização');
    }
    return this.organizationService.addUser(orgId, dto);
  }

  @Get(':orgId/users')
  findUsers(
    @OrgId() callerOrgId: string,
    @Param('orgId') orgId: string,
  ) {
    if (callerOrgId !== orgId) {
      throw new ForbiddenException('Você não pode gerenciar outra organização');
    }
    return this.organizationService.findUsers(orgId);
  }

  @Get(':orgId/users/:userId')
  findUserById(
    @OrgId() callerOrgId: string,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    if (callerOrgId !== orgId) {
      throw new ForbiddenException('Você não pode gerenciar outra organização');
    }
    return this.organizationService.findUserById(orgId, userId);
  }

  @Patch(':orgId/users/:userId')
  updateUser(
    @OrgId() callerOrgId: string,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateOrganizationUserDto,
  ) {
    if (callerOrgId !== orgId) {
      throw new ForbiddenException('Você não pode gerenciar outra organização');
    }
    return this.organizationService.updateUser(orgId, userId, dto);
  }

  @Delete(':orgId/users/:userId')
  removeUser(
    @OrgId() callerOrgId: string,
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    if (callerOrgId !== orgId) {
      throw new ForbiddenException('Você não pode gerenciar outra organização');
    }
    return this.organizationService.removeUser(orgId, userId);
  }
}
