import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ──────────────────────────────────────────────
  // Organization CRUD
  // ──────────────────────────────────────────────

  async create(dto: CreateOrganizationDto) {
    if (dto.cnpj) {
      const existing = await this.prisma.organization.findUnique({
        where: { cnpj: dto.cnpj },
      });
      if (existing) {
        throw new ConflictException('CNPJ já cadastrado');
      }
    }

    return this.prisma.organization.create({
      data: {
        name: dto.name,
        cnpj: dto.cnpj,
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
        where: { cnpj: dto.cnpj, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('CNPJ já cadastrado');
      }
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name,
        cnpj: dto.cnpj,
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
          `Limite de usuários atingido (${org.planMaxUsers}). Avalie um upgrade do plano atual.`,
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

  async getMe(organizationId: string) {
    return this.findById(organizationId);
  }

  async updateSettings(
    organizationId: string,
    settings: Record<string, unknown>,
  ) {
    const org = await this.findById(organizationId);

    if (settings.whatsappNotificationsEnabled === true) {
      const planFeatures = org.planFeatures as Record<string, boolean> | null;
      if (!planFeatures?.whatsapp) {
        throw new ForbiddenException(
          'Notificações WhatsApp não estão incluídas no plano da sua clínica.',
        );
      }
    }

    const incoming = Object.fromEntries(
      Object.entries(settings).filter(([, v]) => v !== undefined),
    );

    const merged = {
      ...((org.settings as Record<string, unknown>) ?? {}),
      ...incoming,
    };

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: merged as Prisma.InputJsonValue },
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

  async getAvailablePlans() {
    const adminUrl = this.config.get<string>('CAREFLOW_ADMIN_URL');
    if (!adminUrl) return [];

    try {
      const res = await fetch(`${adminUrl}/plans`);
      if (!res.ok) {
        this.logger.warn(`Failed to fetch plans from admin: ${res.status}`);
        return [];
      }
      return res.json();
    } catch {
      this.logger.warn('careflow-admin unavailable, returning empty plans list');
      return [];
    }
  }

  async changePlan(organizationId: string, planId: string) {
    const usage = await this.getPlanUsage(organizationId);

    // Fetch the target plan to validate downgrade constraints
    const adminUrl = this.config.get<string>('CAREFLOW_ADMIN_URL');
    if (!adminUrl) throw new ServiceUnavailableException('Serviço de planos indisponível');

    let plan: { id: string; maxPatients: number; maxUsers: number };
    try {
      const res = await fetch(`${adminUrl}/plans/${planId}`);
      if (!res.ok) throw new NotFoundException('Plano não encontrado');
      plan = await res.json();
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new ServiceUnavailableException('Serviço de planos indisponível');
    }

    if (usage.planMaxPatients !== null && plan.maxPatients < usage.currentPatients) {
      throw new BadRequestException(
        `Downgrade não permitido: você possui ${usage.currentPatients} paciente(s) cadastrado(s) e o plano selecionado permite no máximo ${plan.maxPatients}.`,
      );
    }
    if (usage.planMaxUsers !== null && plan.maxUsers < usage.currentUsers) {
      throw new BadRequestException(
        `Downgrade não permitido: você possui ${usage.currentUsers} usuário(s) ativo(s) e o plano selecionado permite no máximo ${plan.maxUsers}.`,
      );
    }

    const apiKey = this.config.getOrThrow<string>('INTERNAL_API_KEY');
    const res = await fetch(`${adminUrl}/subscriptions/change-by-clinic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-api-key': apiKey },
      body: JSON.stringify({ clinicExternalId: organizationId, planId }),
    }).catch(() => {
      throw new ServiceUnavailableException('Serviço de planos indisponível');
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new BadRequestException((body as any)?.message ?? 'Erro ao alterar plano');
    }
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
