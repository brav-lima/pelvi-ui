import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // Organization CRUD
  // ──────────────────────────────────────────────

  async create(dto: CreateOrganizationDto) {
    if (dto.cnpj) {
      const existing = await this.prisma.organization.findUnique({
        where: { document: dto.cnpj },
      });
      if (existing) {
        throw new ConflictException('CNPJ já cadastrado');
      }
    }

    return this.prisma.organization.create({
      data: {
        name: dto.name,
        document: dto.cnpj,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findAll() {
    return this.prisma.organization.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!org) {
      throw new NotFoundException('Organização não encontrada');
    }

    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.findById(id);

    if (dto.cnpj) {
      const existing = await this.prisma.organization.findFirst({
        where: { document: dto.cnpj, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('CNPJ já cadastrado');
      }
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name,
        document: dto.cnpj,
        settings: dto.settings as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);

    return this.prisma.organization.delete({
      where: { id },
    });
  }

  // ──────────────────────────────────────────────
  // OrganizationUser (vínculo Person ↔ Organization)
  // ──────────────────────────────────────────────

  async addUser(organizationId: string, dto: CreateOrganizationUserDto) {
    await this.findById(organizationId);

    const person = await this.prisma.person.findUnique({
      where: { id: dto.personId },
    });
    if (!person) {
      throw new NotFoundException('Pessoa não encontrada');
    }

    const existing = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_personId: {
          organizationId,
          personId: dto.personId,
        },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Pessoa já vinculada a esta organização',
      );
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { planMaxUsers: true },
    });
    if (org?.planMaxUsers) {
      const count = await this.prisma.organizationUser.count({
        where: { organizationId, active: true },
      });
      if (count >= org.planMaxUsers) {
        throw new BadRequestException(
          `Limite de usuários atingido (${org.planMaxUsers}). Faça upgrade do plano.`,
        );
      }
    }

    return this.prisma.organizationUser.create({
      data: {
        organizationId,
        personId: dto.personId,
        role: dto.role,
        permissions: dto.permissions as Prisma.InputJsonValue | undefined,
      },
      include: {
        person: {
          select: {
            id: true,
            cpf: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  async findUsers(organizationId: string) {
    await this.findById(organizationId);

    return this.prisma.organizationUser.findMany({
      where: { organizationId },
      include: {
        person: {
          select: {
            id: true,
            cpf: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { person: { name: 'asc' } },
    });
  }

  async findUserById(organizationId: string, id: string) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { id, organizationId },
      include: {
        person: {
          select: {
            id: true,
            cpf: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Vínculo não encontrado');
    }

    return link;
  }

  async updateUser(
    organizationId: string,
    id: string,
    dto: UpdateOrganizationUserDto,
  ) {
    await this.findUserById(organizationId, id);

    return this.prisma.organizationUser.update({
      where: { id },
      data: {
        role: dto.role,
        permissions: dto.permissions as Prisma.InputJsonValue | undefined,
        active: dto.active,
      },
      include: {
        person: {
          select: {
            id: true,
            cpf: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }

  async getPlanUsage(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { planMaxPatients: true, planMaxUsers: true, accessStatus: true },
    });

    const [currentPatients, currentUsers] = await Promise.all([
      this.prisma.patient.count({ where: { organizationId } }),
      this.prisma.organizationUser.count({ where: { organizationId, active: true } }),
    ]);

    return {
      accessStatus: org?.accessStatus ?? 'ACTIVE',
      planMaxPatients: org?.planMaxPatients ?? null,
      planMaxUsers: org?.planMaxUsers ?? null,
      currentPatients,
      currentUsers,
    };
  }

  async removeUser(organizationId: string, id: string) {
    await this.findUserById(organizationId, id);

    return this.prisma.organizationUser.update({
      where: { id },
      data: { active: false },
      include: {
        person: {
          select: {
            id: true,
            cpf: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
  }
}
