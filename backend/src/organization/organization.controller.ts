import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { OrganizationService } from './organization.service';
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

  // ── Plan usage ──

  @Get('me/plan')
  @ApiOperation({ summary: 'Uso do plano da organização autenticada' })
  getPlanUsage(@OrgId() orgId: string) {
    return this.organizationService.getPlanUsage(orgId);
  }

  // ── Organization CRUD ──
  // Todas as rotas operam sobre a organização do usuário autenticado (orgId vem do JWT).
  // O parâmetro :id existe para conformidade REST mas é validado contra o orgId do token.

  @Get('me')
  @ApiOperation({ summary: 'Dados da organização autenticada' })
  findMe(@OrgId() orgId: string) {
    return this.organizationService.findById(orgId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualizar dados da organização autenticada' })
  update(
    @OrgId() orgId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(orgId, dto);
  }

  // ── OrganizationUser (vínculos) ──
  // orgId vem sempre do JWT — não é necessário passar na URL.

  @Post('users')
  @ApiOperation({ summary: 'Vincular pessoa à organização' })
  addUser(
    @OrgId() orgId: string,
    @Body() dto: CreateOrganizationUserDto,
  ) {
    return this.organizationService.addUser(orgId, dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'Listar membros da organização' })
  findUsers(@OrgId() orgId: string) {
    return this.organizationService.findUsers(orgId);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Buscar membro por ID' })
  findUserById(
    @OrgId() orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.organizationService.findUserById(orgId, userId);
  }

  @Patch('users/:userId')
  @ApiOperation({ summary: 'Atualizar membro da organização' })
  updateUser(
    @OrgId() orgId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateOrganizationUserDto,
  ) {
    return this.organizationService.updateUser(orgId, userId, dto);
  }

  @Delete('users/:userId')
  @ApiOperation({ summary: 'Remover membro da organização' })
  removeUser(
    @OrgId() orgId: string,
    @Param('userId') userId: string,
  ) {
    return this.organizationService.removeUser(orgId, userId);
  }
}
