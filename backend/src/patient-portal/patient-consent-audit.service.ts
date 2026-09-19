import { Injectable } from '@nestjs/common';
import { PatientConsentAction, PatientConsentActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface RecordConsentAuditParams {
  patientAccountLinkId: string;
  action: PatientConsentAction;
  actorType: PatientConsentActorType;
  actorId: string;
}

@Injectable()
export class PatientConsentAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordConsentAuditParams): Promise<void> {
    await this.prisma.patientConsentAudit.create({ data: params });
  }
}
