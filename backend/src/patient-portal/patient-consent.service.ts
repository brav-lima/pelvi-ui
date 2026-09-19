import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PatientAccountLinkService, PatientAccountLinkSummary } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

@Injectable()
export class PatientConsentService {
  constructor(
    private readonly links: PatientAccountLinkService,
    private readonly audits: PatientConsentAuditService,
  ) {}

  async accept(patientAccountId: string, linkId: string): Promise<void> {
    const link = await this.getOwnedPendingLink(patientAccountId, linkId);
    await this.links.updateStatus(link.id, 'ACTIVE', new Date());
    await this.audits.record({
      patientAccountLinkId: link.id,
      action: 'ACCEPTED',
      actorType: 'PATIENT',
      actorId: patientAccountId,
    });
  }

  async decline(patientAccountId: string, linkId: string): Promise<void> {
    const link = await this.getOwnedPendingLink(patientAccountId, linkId);
    await this.links.updateStatus(link.id, 'DECLINED');
    await this.audits.record({
      patientAccountLinkId: link.id,
      action: 'DECLINED',
      actorType: 'PATIENT',
      actorId: patientAccountId,
    });
  }

  private async getOwnedPendingLink(
    patientAccountId: string,
    linkId: string,
  ): Promise<PatientAccountLinkSummary> {
    const link = await this.links.findById(linkId);
    if (!link || link.patientAccountId !== patientAccountId) {
      throw new NotFoundException('Vínculo não encontrado');
    }
    if (link.status !== 'PENDING_CONSENT') {
      throw new ConflictException('Vínculo não está pendente de consentimento');
    }
    return link;
  }
}
