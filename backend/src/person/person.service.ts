import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';

const personSelect = {
  id: true,
  cpf: true,
  name: true,
  email: true,
  phone: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PersonService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePersonDto) {
    const existing = await this.prisma.person.findFirst({
      where: { OR: [{ cpf: dto.cpf }, { email: dto.email }] },
    });

    if (existing) {
      const field = existing.cpf === dto.cpf ? 'CPF' : 'Email';
      throw new ConflictException(`${field} já cadastrado`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const person = await this.prisma.person.create({
      data: {
        cpf: dto.cpf,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
      select: personSelect,
    });

    return person;
  }

  async findAll() {
    return this.prisma.person.findMany({
      select: personSelect,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      select: personSelect,
    });

    if (!person) {
      throw new NotFoundException('Pessoa não encontrada');
    }

    return person;
  }

  async findByCpf(cpf: string) {
    const person = await this.prisma.person.findUnique({
      where: { cpf },
    });

    if (!person) {
      throw new NotFoundException('Pessoa não encontrada');
    }

    return person;
  }

  async update(id: string, dto: UpdatePersonDto) {
    await this.findById(id);

    if (dto.email) {
      const existing = await this.prisma.person.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Email já cadastrado');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    return this.prisma.person.update({
      where: { id },
      data,
      select: personSelect,
    });
  }

  async remove(id: string) {
    await this.findById(id);

    return this.prisma.person.update({
      where: { id },
      data: { active: false },
      select: personSelect,
    });
  }

  async findOrganizations(personId: string) {
    await this.findById(personId);

    const links = await this.prisma.organizationUser.findMany({
      where: { personId, active: true },
      include: {
        organization: true,
      },
      orderBy: { organization: { name: 'asc' } },
    });

    return links.map((link) => ({
      id: link.id,
      role: link.role,
      organization: link.organization,
    }));
  }
}
