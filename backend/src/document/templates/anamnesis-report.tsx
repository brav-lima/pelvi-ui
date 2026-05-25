import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { Prisma } from '@prisma/client';
import { PdfHeader } from './shared/pdf-header';
import { PdfFooter } from './shared/pdf-footer';
import { styles } from './shared/pdf-styles';

type AnamnesisWithRelations = Prisma.AnamnesisGetPayload<{
  include: {
    patient: true;
    professional: { include: { person: { select: { id: true; name: true } } } };
    organization: { select: { id: true; name: true; document: true } };
  };
}>;

interface Props {
  anamnesis: AnamnesisWithRelations;
}

export function AnamnesisReport({ anamnesis }: Props) {
  const data = anamnesis.data as Record<string, unknown>;
  const generatedAt = new Date().toLocaleDateString('pt-BR');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfHeader org={anamnesis.organization} title="Relatório de Anamnese" />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dados da Paciente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome:</Text>
            <Text style={styles.value}>{anamnesis.patient.name}</Text>
          </View>
          {anamnesis.patient.birthDate && (
            <View style={styles.row}>
              <Text style={styles.label}>Data de Nascimento:</Text>
              <Text style={styles.value}>
                {new Date(anamnesis.patient.birthDate).toLocaleDateString('pt-BR')}
              </Text>
            </View>
          )}
          {anamnesis.patient.phone && (
            <View style={styles.row}>
              <Text style={styles.label}>Telefone:</Text>
              <Text style={styles.value}>{anamnesis.patient.phone}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profissional Responsável</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nome:</Text>
            <Text style={styles.value}>{anamnesis.professional.person.name}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Data:</Text>
            <Text style={styles.value}>
              {new Date(anamnesis.createdAt).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anamnese</Text>
          {Object.entries(data).map(([key, value]) => (
            <View key={key} style={styles.row}>
              <Text style={styles.label}>{key}:</Text>
              <Text style={styles.value}>{String(value ?? '—')}</Text>
            </View>
          ))}
          {Object.keys(data).length === 0 && (
            <Text style={styles.textBlock}>Nenhum dado registrado.</Text>
          )}
        </View>

        <PdfFooter
          professional={anamnesis.professional.person.name}
          generatedAt={generatedAt}
        />
      </Page>
    </Document>
  );
}
