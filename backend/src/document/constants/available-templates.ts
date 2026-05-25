import { GeneratedDocumentTemplate } from '@prisma/client';

export const AVAILABLE_TEMPLATES: Array<{
  template: GeneratedDocumentTemplate;
  name: string;
  description: string;
  requiredContext: string[];
}> = [
  {
    template: 'ANAMNESIS_REPORT',
    name: 'Relatório de Anamnese',
    description: 'Exporta os dados da anamnese de uma paciente em PDF',
    requiredContext: ['anamnesisId'],
  },
  {
    template: 'APPOINTMENT_CERTIFICATE',
    name: 'Comprovante de Consulta',
    description: 'Comprovante de presença em consulta',
    requiredContext: ['appointmentId'],
  },
  {
    template: 'ATTENDANCE_TERM',
    name: 'Termo de Comparecimento',
    description: 'Termo formal de comparecimento à clínica',
    requiredContext: ['appointmentId'],
  },
  {
    template: 'EVOLUTION_SUMMARY',
    name: 'Resumo de Evoluções',
    description: 'Resumo das evoluções clínicas de uma paciente',
    requiredContext: ['patientId'],
  },
];
