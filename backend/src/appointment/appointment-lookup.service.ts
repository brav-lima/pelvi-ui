import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AppointmentLookupResult {
  id: string;
  startAt: Date;
  endAt: Date;
  status: AppointmentStatus;
  procedureName: string;
}

@Injectable()
export class AppointmentLookupService {
  constructor(private readonly prisma: PrismaService) {}

  async findUpcomingByPatientId(
    organizationId: string,
    patientId: string,
  ): Promise<AppointmentLookupResult[]> {
    const appointments = await this.prisma.appointment.findMany({
      where: { organizationId, patientId, deletedAt: null },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        procedure: { select: { name: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    return appointments.map((appointment) => ({
      id: appointment.id,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      status: appointment.status,
      procedureName: appointment.procedure.name,
    }));
  }
}
