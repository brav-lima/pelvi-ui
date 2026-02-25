import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateClinicDto } from './dto/create-clinic.dto'

@Injectable()
export class InternalService {
  constructor(private readonly prisma: PrismaService) {}

  async createClinic(dto: CreateClinicDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { cnpj: dto.document },
    })
    if (existing) throw new ConflictException('Organização já existe')

    const clinic = await this.prisma.organization.create({
      data: {
        name: dto.name,
        cnpj: dto.document,
        email: dto.email,
        phone: dto.phone,
      },
    })

    return { clinicId: clinic.id }
  }

  async listClinics() {
    const clinics = await this.prisma.organization.findMany({
      select: { id: true, name: true, cnpj: true, email: true, phone: true, accessStatus: true },
      orderBy: { name: 'asc' },
    })
    return clinics.map((c) => ({
      clinicId: c.id,
      name: c.name,
      document: c.cnpj,
      email: c.email,
      phone: c.phone,
      accessStatus: c.accessStatus,
    }))
  }

  async updateClinicAccess(
    clinicId: string,
    status: 'ACTIVE' | 'BLOCKED',
    maxUsers?: number,
    maxPatients?: number,
  ) {
    const clinic = await this.prisma.organization.findUnique({
      where: { id: clinicId },
    })
    if (!clinic) throw new NotFoundException('Clínica não encontrada')

    const updated = await this.prisma.organization.update({
      where: { id: clinicId },
      data: {
        accessStatus: status,
        ...(maxUsers !== undefined && { planMaxUsers: maxUsers }),
        ...(maxPatients !== undefined && { planMaxPatients: maxPatients }),
      },
    })

    return {
      clinicId: updated.id,
      accessStatus: updated.accessStatus,
      planMaxUsers: updated.planMaxUsers,
      planMaxPatients: updated.planMaxPatients,
    }
  }
}
