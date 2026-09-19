import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { RedisService } from '../redis/redis.service';
import { PatientAccountService } from './patient-account.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientConsentAuditService } from './patient-consent-audit.service';

interface StoredInvite {
  patientAccountId: string;
  linkId: string;
}

@Injectable()
export class PatientActivationService {
  constructor(
    private readonly redis: RedisService,
    private readonly accounts: PatientAccountService,
    private readonly links: PatientAccountLinkService,
    private readonly audits: PatientConsentAuditService,
  ) {}

  async activate(token: string, password: string): Promise<void> {
    const stored = await this.redis.getJson<StoredInvite>(`patient-invite:${token}`);
    if (!stored) {
      throw new BadRequestException('Token inválido ou expirado');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await this.accounts.activate(stored.patientAccountId, passwordHash);
    await this.links.updateStatus(stored.linkId, 'ACTIVE', new Date());
    await this.audits.record({
      patientAccountLinkId: stored.linkId,
      action: 'ACCEPTED',
      actorType: 'PATIENT',
      actorId: stored.patientAccountId,
    });
    await this.redis.del(`patient-invite:${token}`);
  }
}
