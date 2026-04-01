import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  private genAI: GoogleGenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }
    this.genAI = new GoogleGenAI({ apiKey });
  }

  async analyzePatient(organizationId: string, patientId: string): Promise<string> {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, organizationId },
    });

    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    const [anamneses, evolutions, appointments] = await Promise.all([
      this.prisma.anamnesis.findMany({
        where: { patientId, organizationId },
        orderBy: { createdAt: 'asc' },
        include: {
          professional: { include: { person: { select: { name: true } } } },
        },
      }),
      this.prisma.evolution.findMany({
        where: { patientId, organizationId },
        orderBy: { createdAt: 'asc' },
        include: {
          professional: { include: { person: { select: { name: true } } } },
        },
      }),
      this.prisma.appointment.findMany({
        where: { patientId, organizationId },
        orderBy: { startAt: 'asc' },
        include: {
          procedure: { select: { name: true } },
        },
      }),
    ]);

    if (anamneses.length === 0 && evolutions.length === 0) {
      throw new BadRequestException(
        'Paciente sem avaliação ou evoluções registradas. Adicione pelo menos uma avaliação ou evolução antes de gerar a análise.',
      );
    }

    const prompt = this.buildPrompt(patient, anamneses, evolutions, appointments);

    const response = await this.genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text ?? '';
  }

  private buildPrompt(patient: any, anamneses: any[], evolutions: any[], appointments: any[]): string {
    const fmt = (date: Date | string) =>
      new Date(date).toLocaleDateString('pt-BR');

    const age = patient.birthDate
      ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;

    const doneSessions = appointments.filter((a) => a.status === 'DONE').length;
    const totalSessions = appointments.length;

    let prompt = `Você é um assistente clínico especializado em fisioterapia. Analise o prontuário abaixo e gere um relatório estruturado em português brasileiro.

## DADOS DO PACIENTE
- Nome: ${patient.name}
${age ? `- Idade: ${age} anos` : ''}
${patient.gender === 'M' ? '- Sexo: Masculino' : patient.gender === 'F' ? '- Sexo: Feminino' : ''}
${patient.notes ? `- Observações: ${patient.notes}` : ''}
- Total de consultas: ${totalSessions} (${doneSessions} realizadas)
`;

    if (anamneses.length > 0) {
      prompt += `\n## AVALIAÇÕES / ANAMNESES\n`;
      for (const a of anamneses) {
        prompt += `\nAvaliação em ${fmt(a.createdAt)} — Prof. ${a.professional?.person?.name ?? 'N/A'}\n`;
        const data = a.data as Record<string, unknown>;
        for (const [key, value] of Object.entries(data)) {
          if (value) prompt += `- ${key}: ${value}\n`;
        }
      }
    }

    if (evolutions.length > 0) {
      prompt += `\n## EVOLUÇÕES CLÍNICAS (${evolutions.length} registros)\n`;
      for (const e of evolutions) {
        prompt += `\n[${fmt(e.createdAt)}] ${e.professional?.person?.name ?? 'N/A'}\n${e.description}\n`;
      }
    }

    if (appointments.length > 0) {
      const procedures = [...new Set(appointments.map((a) => a.procedure?.name).filter(Boolean))];
      prompt += `\n## PROCEDIMENTOS REALIZADOS\n${procedures.join(', ')}\n`;
    }

    prompt += `
---

Com base nas informações acima, gere um relatório clínico estruturado com as seguintes seções:

**1. Resumo Clínico**
Síntese objetiva do quadro do paciente, principais queixas e condições identificadas.

**2. Análise do Progresso**
Avaliação da evolução do paciente com base nos registros disponíveis. Identifique melhoras, estagnações ou pioras.

**3. Prognóstico**
Perspectiva de recuperação considerando o quadro clínico, adesão ao tratamento e evolução observada.

**4. Estimativa de Alta**
Previsão de critérios e prazo estimado para alta fisioterapêutica, justificando com base nos dados clínicos.

**5. Recomendações**
Sugestões para continuidade do tratamento, ajustes de protocolo ou encaminhamentos necessários.

---
*Atenção: Esta análise é um apoio clínico baseado nos dados registrados e não substitui o julgamento do profissional de saúde responsável.*
`;

    return prompt;
  }
}
