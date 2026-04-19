import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { CreateClinicDto } from './dto/create-clinic.dto'
import { CreateInternalPersonDto } from './dto/create-internal-person.dto'
import { LinkClinicUserDto } from './dto/link-clinic-user.dto'
import { UpdateClinicUserDto } from './dto/update-clinic-user.dto'
import { ResetClinicUserPasswordDto } from './dto/reset-clinic-user-password.dto'

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

  async upsertPerson(dto: CreateInternalPersonDto) {
    const existingByCpf = await this.prisma.person.findUnique({ where: { cpf: dto.cpf } })
    if (existingByCpf) {
      return { person: this.toPublicPerson(existingByCpf), reused: true }
    }

    const existingByEmail = await this.prisma.person.findUnique({ where: { email: dto.email } })
    if (existingByEmail) {
      throw new ConflictException('Email já cadastrado para outro CPF')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const created = await this.prisma.person.create({
      data: {
        cpf: dto.cpf,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
      },
    })

    return { person: this.toPublicPerson(created), reused: false }
  }

  async linkClinicUser(clinicId: string, dto: LinkClinicUserDto) {
    const clinic = await this.prisma.organization.findUnique({ where: { id: clinicId } })
    if (!clinic) throw new NotFoundException('Clínica não encontrada')

    const person = await this.prisma.person.findUnique({ where: { id: dto.personId } })
    if (!person) throw new NotFoundException('Pessoa não encontrada')

    const role = dto.role ?? Role.ADMIN

    const existing = await this.prisma.organizationUser.findUnique({
      where: { organizationId_personId: { organizationId: clinicId, personId: dto.personId } },
    })

    if (existing) {
      if (existing.active && existing.role === role) {
        return { organizationUserId: existing.id, reused: true }
      }
      const updated = await this.prisma.organizationUser.update({
        where: { id: existing.id },
        data: { active: true, role },
      })
      return { organizationUserId: updated.id, reused: true }
    }

    const link = await this.prisma.organizationUser.create({
      data: { organizationId: clinicId, personId: dto.personId, role },
    })
    return { organizationUserId: link.id, reused: false }
  }

  async listClinicUsers(clinicId: string) {
    const clinic = await this.prisma.organization.findUnique({ where: { id: clinicId } })
    if (!clinic) throw new NotFoundException('Clínica não encontrada')

    const links = await this.prisma.organizationUser.findMany({
      where: { organizationId: clinicId },
      include: { person: true },
      orderBy: { person: { name: 'asc' } },
    })

    return links.map((l) => ({
      organizationUserId: l.id,
      personId: l.person.id,
      cpf: l.person.cpf,
      name: l.person.name,
      email: l.person.email,
      phone: l.person.phone,
      role: l.role,
      linkActive: l.active,
      personActive: l.person.active,
      createdAt: l.createdAt,
    }))
  }

  async updateClinicUser(clinicId: string, organizationUserId: string, dto: UpdateClinicUserDto) {
    const link = await this.prisma.organizationUser.findUnique({
      where: { id: organizationUserId },
    })
    if (!link || link.organizationId !== clinicId) {
      throw new NotFoundException('Vínculo não encontrado nesta clínica')
    }

    const data: { active?: boolean; role?: typeof link.role } = {}
    if (dto.active !== undefined) data.active = dto.active
    if (dto.role !== undefined) data.role = dto.role

    const updated = await this.prisma.organizationUser.update({
      where: { id: organizationUserId },
      data,
    })

    return {
      organizationUserId: updated.id,
      active: updated.active,
      role: updated.role,
    }
  }

  async resetClinicUserPassword(
    clinicId: string,
    organizationUserId: string,
    dto: ResetClinicUserPasswordDto,
  ) {
    const link = await this.prisma.organizationUser.findUnique({
      where: { id: organizationUserId },
    })
    if (!link || link.organizationId !== clinicId) {
      throw new NotFoundException('Vínculo não encontrado nesta clínica')
    }

    const passwordHash = await bcrypt.hash(dto.password, 10)
    await this.prisma.person.update({
      where: { id: link.personId },
      data: { passwordHash },
    })

    return { personId: link.personId }
  }

  private toPublicPerson(person: { id: string; cpf: string; name: string; email: string; phone: string | null; active: boolean }) {
    return {
      personId: person.id,
      cpf: person.cpf,
      name: person.name,
      email: person.email,
      phone: person.phone,
      active: person.active,
    }
  }
}
