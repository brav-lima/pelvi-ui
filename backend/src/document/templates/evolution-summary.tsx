import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { Prisma } from '@prisma/client';
import { PdfHeader } from './shared/pdf-header';
import { PdfFooter } from './shared/pdf-footer';
import { styles } from './shared/pdf-styles';

type EvolutionWithRelations = Prisma.EvolutionGetPayload<{
  include: {
    professional: { include: { person: { select: { id: true; name: true } } } };
    appointment: { include: { procedure: true } };
  };
}>;

type PatientWithOrg = Prisma.PatientGetPayload<{ select: { id: true; name: true; birthDate: true } }>;
type OrgInfo = { name: string; document: string | null };

interface Props {
  patient: PatientWithOrg;
  organization: OrgInfo;
  evolutions: EvolutionWithRelations[];
}

export function EvolutionSummary({ patient, organization, evolutions }: Props) {
  const generatedAt = new Date().toLocaleDateString('pt-BR');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader org={organization} title="Resumo de Evoluções Clínicas" />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paciente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome:</Text>
            <Text style={styles.value}>{patient.name}</Text>
          </View>
          {patient.birthDate && (
            <View style={styles.row}>
              <Text style={styles.label}>Data de Nascimento:</Text>
              <Text style={styles.value}>
                {new Date(patient.birthDate).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Total de Evoluções:</Text>
            <Text style={styles.value}>{evolutions.length}</Text>
          </View>
        </View>

        {evolutions.map((evolution, index) => (
          <View key={evolution.id} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>
              {`${index + 1}. `}
              {new Date(evolution.createdAt).toLocaleDateString('pt-BR')}
              {evolution.appointment
                ? ` — ${evolution.appointment.procedure.name}`
                : ''}
            </Text>
            <View style={styles.row}>
              <Text style={styles.label}>Profissional:</Text>
              <Text style={styles.value}>{evolution.professional.person.name}</Text>
            </View>
            <Text style={styles.textBlock}>{evolution.description}</Text>
          </View>
        ))}

        {evolutions.length === 0 && (
          <Text style={styles.textBlock}>Nenhuma evolução registrada para esta paciente.</Text>
        )}

        <PdfFooter generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}
