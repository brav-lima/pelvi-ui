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

export function AttendanceTerm({ appointment }: Props) {
  const generatedAt = new Date().toLocaleDateString('pt-BR');
  const startDate = new Date(appointment.startAt);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader org={appointment.organization} title="Termo de Comparecimento" />

        <View style={styles.section}>
          <Text style={styles.textBlock}>
            Declaro, para os devidos fins, que a paciente{' '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{appointment.patient.name}</Text>{' '}
            compareceu a esta clínica no dia{' '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>
              {startDate.toLocaleDateString('pt-BR')}
            </Text>
            {', das '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>
              {new Date(appointment.startAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {' às '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>
              {new Date(appointment.endAt).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
            {', para sessão de '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{appointment.procedure.name}</Text>
            {', sob os cuidados do(a) profissional '}
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>
              {appointment.professional.person.name}
            </Text>
            .
          </Text>
        </View>

        <View style={[styles.section, { marginTop: 40 }]}>
          <View style={{ borderTopWidth: 0.5, borderTopColor: '#374151', width: 200, paddingTop: 4 }}>
            <Text style={styles.footerText ?? styles.textBlock}>
              {appointment.organization.name}
            </Text>
          </View>
        </View>

        <PdfFooter
          professional={appointment.professional.person.name}
          generatedAt={generatedAt}
        />
      </Page>
    </Document>
  );
}
