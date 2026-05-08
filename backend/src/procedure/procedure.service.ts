import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProcedureDto } from './dto/create-procedure.dto';
import { UpdateProcedureDto } from './dto/update-procedure.dto';

@Injectable()
export class ProcedureService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateProcedureDto) {
    return this.prisma.procedure.create({
      data: {
        organizationId,
        name: dto.name,
        durationMinutes: dto.durationMinutes,
        price: dto.price,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.procedure.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async findById(organizationId: string, id: string) {
    const procedure = await this.prisma.procedure.findFirst({
      where: { id, organizationId },
    });

    if (!procedure) {
      throw new NotFoundException('Procedimento não encontrado');
    }

    return procedure;
  }

  async update(organizationId: string, id: string, dto: UpdateProcedureDto) {
    await this.findById(organizationId, id);

    return this.prisma.procedure.update({
      where: { id },
      data: dto,
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findById(organizationId, id);

    return this.prisma.procedure.delete({ where: { id } });
  }
}
