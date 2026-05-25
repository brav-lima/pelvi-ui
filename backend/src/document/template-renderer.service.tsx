import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { renderToBuffer } from '@react-pdf/renderer';
import { GeneratedDocumentTemplate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnamnesisReport } from './templates/anamnesis-report';
import { AppointmentCertificate } from './templates/appointment-certificate';
import { AttendanceTerm } from './templates/attendance-term';
import { EvolutionSummary } from './templates/evolution-summary';

@Injectable()
export class TemplateRendererService {
  private readonly logger = new Logger(TemplateRendererService.name);

  constructor(private readonly prisma: PrismaService) {}

  async render(
    orgId: string,
    template: GeneratedDocumentTemplate,
    context: Record<string, string>,
  ): Promise<StreamableFile> {
    this.logger.log({ msg: 'pdf_generate_start', template, orgId });

    switch (template) {
      case 'ANAMNESIS_REPORT':
        return this.renderAnamnesis(orgId, context);
      case 'APPOINTMENT_CERTIFICATE':
        return this.renderAppointmentCertificate(orgId, context);
      case 'ATTENDANCE_TERM':
        return this.renderAttendanceTerm(orgId, context);
      case 'EVOLUTION_SUMMARY':
        return this.renderEvolutionSummary(orgId, context);
      default:
        throw new BadRequestException(`Template não implementado: ${template}`);
    }
  }

  private async renderAnamnesis(orgId: string, ctx: Record<string, string>) {
    const { anamnesisId } = ctx;
    if (!anamnesisId) throw new BadRequestException('anamnesisId é obrigatório');

    const anamnesis = await this.prisma.anamnesis.findFirst({
      where: { id: anamnesisId, organizationId: orgId },
      include: {
        patient: true,
        professional: { include: { person: { select: { id: true, name: true } } } },
        organization: { select: { id: true, name: true, document: true } },
      },
    });

    if (!anamnesis) throw new NotFoundException('Anamnese não encontrada');

    const buffer = await renderToBuffer(<AnamnesisReport anamnesis={anamnesis} />);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="anamnese-${this.sanitizeFilename(anamnesis.patient.name)}.pdf"`,
    });
  }

  private async renderAppointmentCertificate(orgId: string, ctx: Record<string, string>) {
    const { appointmentId } = ctx;
    if (!appointmentId) throw new BadRequestException('appointmentId é obrigatório');

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId: orgId, deletedAt: null },
      include: {
        patient: true,
        professional: { include: { person: { select: { id: true, name: true } } } },
        procedure: true,
        organization: { select: { id: true, name: true, document: true } },
      },
    });

    if (!appointment) throw new NotFoundException('Consulta não encontrada');

    const buffer = await renderToBuffer(<AppointmentCertificate appointment={appointment} />);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="comprovante-${this.sanitizeFilename(appointment.patient.name)}.pdf"`,
    });
  }

  private async renderAttendanceTerm(orgId: string, ctx: Record<string, string>) {
    const { appointmentId } = ctx;
    if (!appointmentId) throw new BadRequestException('appointmentId é obrigatório');

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId: orgId, deletedAt: null },
      include: {
        patient: true,
        professional: { include: { person: { select: { id: true, name: true } } } },
        procedure: true,
        organization: { select: { id: true, name: true, document: true } },
      },
    });

    if (!appointment) throw new NotFoundException('Consulta não encontrada');

    const buffer = await renderToBuffer(<AttendanceTerm appointment={appointment} />);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="termo-${this.sanitizeFilename(appointment.patient.name)}.pdf"`,
    });
  }

  private async renderEvolutionSummary(orgId: string, ctx: Record<string, string>) {
    const { patientId } = ctx;
    if (!patientId) throw new BadRequestException('patientId é obrigatório');

    const [patient, evolutions] = await Promise.all([
      this.prisma.patient.findFirst({
        where: { id: patientId, organizationId: orgId },
        select: { id: true, name: true, birthDate: true },
      }),
      this.prisma.evolution.findMany({
        where: { patientId, organizationId: orgId },
        include: {
          professional: { include: { person: { select: { id: true, name: true } } } },
          appointment: { include: { procedure: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    if (!patient) throw new NotFoundException('Paciente não encontrada');

    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, document: true },
    });

    if (!organization) throw new NotFoundException('Organização não encontrada');

    const buffer = await renderToBuffer(
      <EvolutionSummary patient={patient} organization={organization} evolutions={evolutions} />,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="evolucoes-${this.sanitizeFilename(patient.name)}.pdf"`,
    });
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').trim().replace(/\s+/g, '-');
  }
}
