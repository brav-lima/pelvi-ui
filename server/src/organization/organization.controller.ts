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
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto';

@ApiBearerAuth()
@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
  ) {}

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
    @Param('orgId') orgId: string,
    @Body() dto: CreateOrganizationUserDto,
  ) {
    return this.organizationService.addUser(orgId, dto);
  }

  @Get(':orgId/users')
  findUsers(@Param('orgId') orgId: string) {
    return this.organizationService.findUsers(orgId);
  }

  @Get(':orgId/users/:userId')
  findUserById(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.organizationService.findUserById(orgId, userId);
  }

  @Patch(':orgId/users/:userId')
  updateUser(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateOrganizationUserDto,
  ) {
    return this.organizationService.updateUser(orgId, userId, dto);
  }

  @Delete(':orgId/users/:userId')
  removeUser(
    @Param('orgId') orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.organizationService.removeUser(orgId, userId);
  }
}
