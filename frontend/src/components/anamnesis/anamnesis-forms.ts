import type { AnamnesisType } from '@/types/clinic';

export interface SectionDef {
  id: string;
  title: string;
  kind: 'narrative' | 'structured';
  placeholder?: string;
  /** Full guidance line, e.g. "Investigar: ...". Display-only — never stored. */
  guidance?: string;
  component?: 'identification' | 'gestationalData' | 'ultrasound';
}

export const ANAMNESIS_TYPE_LABELS: Record<AnamnesisType, string> = {
  PELVIC_GENERAL: 'Anamnese Pélvica Geral',
  PREGNANCY: 'Anamnese Gestacional',
};

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getSections(data: unknown): Record<string, unknown> {
  return asRecord(asRecord(data).sections);
}

const narrative = (
  id: string,
  title: string,
  placeholder: string,
  guidance?: string,
): SectionDef => ({ id, title, kind: 'narrative', placeholder, guidance });

export const ANAMNESIS_FORMS: Record<AnamnesisType, SectionDef[]> = {
  PELVIC_GENERAL: [
    { id: 'identification', title: 'Identificação', kind: 'structured', component: 'identification' },
    narrative(
      'chiefComplaint',
      'Queixa principal',
      'Descreva a principal queixa relatada pela paciente...',
      'Investigar: motivo da consulta, sintomas predominantes, principal desconforto ou limitação e impacto percebido pela paciente.',
    ),
    narrative(
      'currentHistory',
      'História da queixa atual',
      'Descreva a história clínica da paciente...',
      'Investigar: início e evolução dos sintomas, frequência, intensidade, fatores de melhora e piora, tratamentos anteriores e impacto na qualidade de vida.',
    ),
    narrative(
      'healthHistory',
      'Histórico de saúde',
      'Descreva os antecedentes e informações relevantes de saúde...',
      'Investigar: condições de saúde, comorbidades, cirurgias, medicamentos em uso, alergias, tratamentos prévios e exames relevantes.',
    ),
    narrative(
      'urinarySymptoms',
      'Sintomas urinários',
      'Descreva os hábitos e sintomas urinários...',
      'Investigar: frequência urinária diurna e noturna, urgência, perdas urinárias e situações associadas, jato urinário, necessidade de esforço, dor, sensação de esvaziamento incompleto, uso de absorventes/protetores e histórico de infecções urinárias.',
    ),
    narrative(
      'bowelSymptoms',
      'Sintomas intestinais',
      'Descreva os hábitos e sintomas intestinais...',
      'Investigar: frequência evacuatória, consistência das fezes, esforço, dor, sensação de evacuação incompleta, necessidade de manobras, perdas de fezes ou gases, distensão abdominal e uso de laxativos.',
    ),
    narrative(
      'sexualSymptoms',
      'Sintomas sexuais',
      'Descreva os aspectos relacionados à função sexual...',
      'Investigar: atividade sexual, presença de dor, localização e momento da dor, ardência, sensação de bloqueio, lubrificação, sensibilidade, orgasmo e impacto dos sintomas na vida sexual.',
    ),
    narrative(
      'gynecologicalObstetricHistory',
      'Histórico ginecológico e obstétrico',
      'Descreva o histórico ginecológico e obstétrico...',
      'Investigar: menarca, características do ciclo menstrual, DUM, cólicas, menopausa, condições ginecológicas, método contraceptivo, gestações, partos, abortamentos, lacerações, episiotomia e intercorrências obstétricas.',
    ),
    narrative(
      'behavioralHabits',
      'Hábitos comportamentais',
      'Descreva hábitos e aspectos da rotina que possam estar relacionados às queixas...',
      'Investigar: ingestão hídrica, consumo de cafeína, atividade física, rotina ocupacional, hábitos urinários e intestinais, posição para evacuar, sono e fatores emocionais relacionados aos sintomas.',
    ),
    narrative(
      'treatmentExpectations',
      'Expectativas com o tratamento',
      'Descreva os objetivos e expectativas da paciente com o tratamento...',
      'Investigar: objetivos pessoais, atividades que deseja retomar, limitações consideradas mais importantes e expectativas em relação à fisioterapia.',
    ),
    narrative(
      'additionalNotes',
      'Observações complementares',
      'Registre outras informações relevantes para a avaliação...',
    ),
  ],
  PREGNANCY: [
    {
      id: 'gestationalData',
      title: 'Identificação e dados gestacionais',
      kind: 'structured',
      component: 'gestationalData',
    },
    narrative(
      'obstetricHistory',
      'Histórico obstétrico',
      'Descreva o histórico obstétrico da paciente...',
      'Investigar: gestações anteriores, partos vaginais e cesáreas, abortamentos, intercorrências gestacionais, lacerações, episiotomia e experiências relevantes em gestações ou partos anteriores.',
    ),
    narrative(
      'currentPregnancyHistory',
      'História da gestação atual',
      'Descreva a evolução da gestação atual...',
      'Investigar: acompanhamento pré-natal, evolução da gestação, classificação de risco, intercorrências, restrições ou recomendações obstétricas e demais informações relevantes para o atendimento fisioterapêutico.',
    ),
    {
      id: 'ultrasound',
      title: 'Exames complementares: última ultrassonografia obstétrica',
      kind: 'structured',
      component: 'ultrasound',
    },
    narrative(
      'otherExams',
      'Outros exames',
      'Registre outros exames e resultados relevantes...',
      'Registrar exames laboratoriais, exames de imagem e demais achados relevantes para acompanhamento fisioterapêutico durante a gestação.',
    ),
    narrative(
      'healthHistory',
      'Histórico de saúde',
      'Descreva os antecedentes e informações relevantes de saúde...',
      'Investigar: condições prévias ou atuais de saúde, comorbidades, cirurgias, medicamentos, alergias, tratamentos e informações relevantes para a segurança do atendimento durante a gestação.',
    ),
    narrative(
      'musculoskeletalPelvicSymptoms',
      'Sintomas musculoesqueléticos e pélvicos',
      'Descreva as principais queixas musculoesqueléticas e pélvicas...',
      'Investigar: dor lombar, pélvica, sacroilíaca, púbica, perineal ou outras queixas, limitações funcionais, fatores de melhora e piora e impacto nas atividades diárias.',
    ),
    narrative(
      'urinarySymptoms',
      'Sintomas urinários',
      'Descreva os hábitos e sintomas urinários...',
      'Investigar: frequência urinária, noctúria, urgência, perdas urinárias, situações associadas aos escapes, dor, dificuldade miccional e sensação de esvaziamento incompleto.',
    ),
    narrative(
      'bowelSymptoms',
      'Sintomas intestinais',
      'Descreva os hábitos e sintomas intestinais...',
      'Investigar: frequência evacuatória, consistência das fezes, esforço, dor, sensação de evacuação incompleta, necessidade de manobras e perdas de fezes ou gases.',
    ),
    narrative(
      'sexualSymptoms',
      'Sintomas sexuais',
      'Descreva os aspectos relacionados à função sexual durante a gestação...',
      'Investigar: atividade sexual, dor, desconforto, lubrificação, sensibilidade, desejo, orgasmo e possíveis mudanças percebidas durante a gestação.',
    ),
    narrative(
      'behavioralHabits',
      'Hábitos comportamentais e atividade física',
      'Descreva hábitos, rotina e atividade física...',
      'Investigar: ingestão hídrica, atividade física, rotina ocupacional, sono, hábitos urinários e intestinais e outros fatores comportamentais relevantes.',
    ),
    narrative(
      'birthPlanning',
      'Planejamento e expectativas para o parto',
      'Descreva o planejamento e as expectativas da paciente para o parto...',
      'Investigar: via de parto desejada ou planejada, expectativas, receios, experiências anteriores, orientações já recebidas e aspectos que a paciente considera importantes para o parto.',
    ),
    narrative(
      'physiotherapyGoals',
      'Objetivos com a fisioterapia pélvica',
      'Descreva os principais objetivos da paciente com o acompanhamento fisioterapêutico...',
      'Investigar: queixas que deseja tratar, preparação para o parto, prevenção de sintomas, manutenção da função e demais expectativas relacionadas ao acompanhamento fisioterapêutico.',
    ),
    narrative(
      'additionalNotes',
      'Observações complementares',
      'Registre outras informações relevantes para o acompanhamento da gestação...',
    ),
  ],
};
