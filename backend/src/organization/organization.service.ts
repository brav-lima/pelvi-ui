import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateOrganizationUserDto } from './dto/create-organization-user.dto';
import { UpdateOrganizationUserDto } from './dto/update-organization-user.dto';
import { InviteProfessionalDto } from './dto/invite-professional.dto';

const personLinkSelect = {
  id: true,
  cpf: true,
  name: true,
  email: true,
  phone: true,
} as const;

/** Mascara um nome mantendo as 2 primeiras letras do primeiro e do último token. */
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const mask = (w: string) =>
    w.length <= 2 ? `${w[0]}*` : w.slice(0, 2) + '*'.repeat(w.length - 2);
  if (parts.length === 0) return '***';
  if (parts.length === 1) return mask(parts[0]);
  return `${mask(parts[0])} ${mask(parts[parts.length - 1])}`;
}

/** Mascara um e-mail: `maria@gmail.com` -> `m***@g***.com`. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const [host, ...tldParts] = domain.split('.');
  const tld = tldParts.join('.');
  return `${local[0]}***@${host[0]}***${tld ? `.${tld}` : ''}`;
}

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
        email: dto.email,
        phone: dto.phone,
        legalName: dto.legalName,
        stateRegistration: dto.stateRegistration,
        addressCep: dto.addressCep,
        addressStreet: dto.addressStreet,
        addressNumber: dto.addressNumber,
        addressComplement: dto.addressComplement,
        addressNeighborhood: dto.addressNeighborhood,
        addressCity: dto.addressCity,
        addressState: dto.addressState,
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

    return this.linkPerson(
      organizationId,
      dto.personId,
      dto.role,
      dto.permissions as Prisma.InputJsonValue | undefined,
    );
  }

  /**
   * Cria o vínculo Person ↔ Organization, validando vínculo duplicado e
   * limite de usuários do plano. `client` permite reuso dentro de uma transação.
   */
  private async linkPerson(
    organizationId: string,
    personId: string,
    role: Role | undefined,
    permissions?: Prisma.InputJsonValue,
    client: Prisma.TransactionClient = this.prisma,
  ) {
    const existing = await client.organizationUser.findUnique({
      where: {
        organizationId_personId: { organizationId, personId },
      },
    });
    if (existing) {
      throw new ConflictException(
        'Profissional já vinculado a esta clínica',
      );
    }

    const org = await client.organization.findUnique({
      where: { id: organizationId },
      select: { planMaxUsers: true },
    });
    if (org?.planMaxUsers) {
      const count = await client.organizationUser.count({
        where: { organizationId, active: true },
      });
      if (count >= org.planMaxUsers) {
        throw new BadRequestException(
          `Limite de usuários atingido (${org.planMaxUsers}). Faça upgrade do plano.`,
        );
      }
    }

    return client.organizationUser.create({
      data: { organizationId, personId, role, permissions },
      include: { person: { select: personLinkSelect } },
    });
  }

  /**
   * Consulta se existe uma Person com o CPF informado, retornando apenas
   * dados mascarados — suficiente para o admin confirmar a identidade sem
   * expor PII completa de pessoas de outras clínicas.
   */
  async lookupPersonByCpf(cpf: string) {
    const person = await this.prisma.person.findUnique({
      where: { cpf },
      select: { name: true, email: true },
    });

    if (!person) {
      return { exists: false as const };
    }

    return {
      exists: true as const,
      maskedName: maskName(person.name),
      maskedEmail: maskEmail(person.email),
    };
  }

  /**
   * Convida um profissional pelo CPF:
   * - Person já existe → apenas cria o vínculo (dados enviados são ignorados).
   * - Person não existe → exige nome/e-mail/senha e cria Person + vínculo (transacional).
   */
  async inviteProfessional(organizationId: string, dto: InviteProfessionalDto) {
    await this.findById(organizationId);

    const person = await this.prisma.person.findUnique({
      where: { cpf: dto.cpf },
    });

    if (person) {
      return this.linkPerson(organizationId, person.id, dto.role);
    }

    if (!dto.name || !dto.email || !dto.password) {
      throw new BadRequestException(
        'Nome, e-mail e senha são obrigatórios para cadastrar um novo profissional',
      );
    }

    const emailTaken = await this.prisma.person.findFirst({
      where: { email: dto.email },
    });
    if (emailTaken) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.person.create({
        data: {
          cpf: dto.cpf,
          name: dto.name!,
          email: dto.email!,
          phone: dto.phone,
          passwordHash,
        },
      });

      return this.linkPerson(organizationId, created.id, dto.role, undefined, tx);
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
