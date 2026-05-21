import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfessionalDto } from './dto/update-professional.dto';

@Injectable()
export class ProfessionalService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string, search?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (search) {
      where.person = { name: { contains: search, mode: 'insensitive' } };
    }

    const users = await this.prisma.organizationUser.findMany({
      where,
      include: {
        person: {
          select: {
            id: true,
            name: true,
            cpf: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { person: { name: 'asc' } },
    });

    return users.map((u) => ({
      id: u.id,
      role: u.role,
      active: u.active,
      specialty: u.specialty,
      professionalRegistration: u.professionalRegistration,
      person: u.person,
    }));
  }

  async findById(organizationId: string, id: string) {
    const user = await this.prisma.organizationUser.findFirst({
      where: { id, organizationId },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            cpf: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Profissional não encontrado');
    }

    return {
      id: user.id,
      role: user.role,
      active: user.active,
      specialty: user.specialty,
      professionalRegistration: user.professionalRegistration,
      person: user.person,
    };
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateProfessionalDto,
  ) {
    await this.findById(organizationId, id);

    const updated = await this.prisma.organizationUser.update({
      where: { id },
      data: {
        role: dto.role,
        active: dto.active,
        specialty: dto.specialty,
        professionalRegistration: dto.professionalRegistration,
      },
      include: {
        person: {
          select: {
            id: true,
            name: true,
            cpf: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      role: updated.role,
      active: updated.active,
      specialty: updated.specialty,
      professionalRegistration: updated.professionalRegistration,
      person: updated.person,
    };
  }
}
