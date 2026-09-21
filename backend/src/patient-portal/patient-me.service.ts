import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentLookupService, AppointmentLookupResult } from '../appointment/appointment-lookup.service';
import { PatientLookupService } from '../patient/patient-lookup.service';
import { PatientAccountLinkService } from './patient-account-link.service';
import { PatientTreatmentPlanFeatures, PatientTreatmentPlanService } from './patient-treatment-plan.service';

export interface PatientClinicSummary {
  organizationId: string;
  organizationName: string;
}

export interface PatientFicha {
  name: string;
  cpfMasked: string;
  phone: string | null;
  birthDate: Date | null;
  clinics: PatientClinicSummary[];
}

@Injectable()
export class PatientMeService {
  constructor(
    private readonly links: PatientAccountLinkService,
    private readonly patientLookup: PatientLookupService,
    private readonly appointmentLookup: AppointmentLookupService,
    private readonly plans: PatientTreatmentPlanService,
  ) {}

  async getFicha(patientAccountId: string, patientId: string): Promise<PatientFicha> {
    const activeLinks = (await this.links.findAllByAccountId(patientAccountId)).filter(
      (link) => link.status === 'ACTIVE',
    );
    const patients = await Promise.all(activeLinks.map((link) => this.patientLookup.findById(link.patientId)));
    const current = patients.find((patient) => patient?.id === patientId);

    if (!current) {
      throw new NotFoundException('Paciente não encontrada');
    }

    return {
      name: current.name,
      cpfMasked: maskCpf(current.cpf ?? ''),
      phone: current.phone,
      birthDate: current.birthDate,
      clinics: activeLinks.map((link, index) => ({
        organizationId: link.organizationId,
        organizationName: patients[index]?.organizationName ?? '',
      })),
    };
  }

  async getAppointments(organizationId: string, patientId: string): Promise<AppointmentLookupResult[]> {
    return this.appointmentLookup.findUpcomingByPatientId(organizationId, patientId);
  }

  async getFeatures(organizationId: string, patientId: string): Promise<PatientTreatmentPlanFeatures> {
    return this.plans.getForPatient(organizationId, patientId);
  }
}

function maskCpf(cpf: string): string {
  if (cpf.length !== 11) return cpf;
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}
