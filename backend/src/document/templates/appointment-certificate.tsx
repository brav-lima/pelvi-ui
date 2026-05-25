import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { Prisma } from '@prisma/client';
import { PdfHeader } from './shared/pdf-header';
import { PdfFooter } from './shared/pdf-footer';
import { styles } from './shared/pdf-styles';

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: {
    patient: true;
    professional: { include: { person: { select: { id: true; name: true } } } };
    procedure: true;
    organization: { select: { id: true; name: true; document: true } };
  };
}>;

interface Props {
  appointment: AppointmentWithRelations;
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Agendada',
  CONFIRMED: 'Confirmada',
  CANCELED: 'Cancelada',
  DONE: 'Realizada',
};

export function AppointmentCertificate({ appointment }: Props) {
  const generatedAt = new Date().toLocaleDateString('pt-BR');
  const startDate = new Date(appointment.startAt);
  const endDate = new Date(appointment.endAt);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader org={appointment.organization} title="Comprovante de Consulta" />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados da Consulta</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Data:</Text>
            <Text style={styles.value}>{startDate.toLocaleDateString('pt-BR')}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Horário:</Text>
            <Text style={styles.value}>
              {startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {endDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Procedimento:</Text>
            <Text style={styles.value}>{appointment.procedure.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{STATUS_LABELS[appointment.status] ?? appointment.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paciente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome:</Text>
            <Text style={styles.value}>{appointment.patient.name}</Text>
          </View>
          {appointment.patient.phone && (
            <View style={styles.row}>
              <Text style={styles.label}>Telefone:</Text>
              <Text style={styles.value}>{appointment.patient.phone}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profissional</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome:</Text>
            <Text style={styles.value}>{appointment.professional.person.name}</Text>
          </View>
        </View>

        {appointment.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.textBlock}>{appointment.notes}</Text>
          </View>
        )}

        <PdfFooter
          professional={appointment.professional.person.name}
          generatedAt={generatedAt}
        />
      </Page>
    </Document>
  );
}
