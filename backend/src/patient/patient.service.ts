import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientDto } from './dto/query-patient.dto';

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreatePatientDto) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { planMaxPatients: true },
    });
    if (org?.planMaxPatients) {
      const count = await this.prisma.patient.count({
        where: { organizationId, deletedAt: null },
      });
      if (count >= org.planMaxPatients) {
        throw new BadRequestException(
          `Limite de pacientes atingido (${org.planMaxPatients}). Faça upgrade do plano.`,
        );
      }
    }

    return this.prisma.patient.create({
      data: {
        organizationId,
        name: dto.name,
        cpf: dto.cpf,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        email: dto.email,
        phone: dto.phone,
        gender: dto.gender,
        addressCep: dto.addressCep,
        addressStreet: dto.addressStreet,
        addressNumber: dto.addressNumber,
        addressComplement: dto.addressComplement,
        addressNeighborhood: dto.addressNeighborhood,
        addressCity: dto.addressCity,
        addressState: dto.addressState,
        notes: dto.notes,
      },
    });
  }

  async findAll(organizationId: string, query: QueryPatientDto) {
    const now = new Date();
    const { search, page = 1, limit = 20, orderBy, hasActivePackage, hasNoUpcomingAppointment } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId, deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cpf: { contains: search } },
      ];
    }

    if (hasActivePackage) {
      where.treatmentPackages = { some: { status: 'ACTIVE' } };
    }

    if (hasNoUpcomingAppointment) {
      where.appointments = {
        none: {
          startAt: { gte: now },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
      };
    }

    const prismaOrderBy = orderBy === 'name_desc' ? { name: 'desc' as const } : { name: 'asc' as const };

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({ where, orderBy: prismaOrderBy, skip, take: limit }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(organizationId: string, id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    return patient;
  }

  async update(organizationId: string, id: string, dto: UpdatePatientDto) {
    await this.findById(organizationId, id);

    return this.prisma.patient.update({
      where: { id },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findById(organizationId, id);

    return this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
