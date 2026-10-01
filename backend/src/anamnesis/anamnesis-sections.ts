import { BadRequestException } from '@nestjs/common';
import { AnamnesisType } from '@prisma/client';

type SectionKind = 'narrative' | 'structured';

// Section ids per form type. Titles/placeholders/guidance live in the frontend
// form definitions; the backend only needs ids + kind to validate.
export const ANAMNESIS_SECTIONS: Record<AnamnesisType, Record<string, SectionKind>> = {
  PELVIC_GENERAL: {
    identification: 'structured',
    chiefComplaint: 'narrative',
    currentHistory: 'narrative',
    healthHistory: 'narrative',
    urinarySymptoms: 'narrative',
    bowelSymptoms: 'narrative',
    sexualSymptoms: 'narrative',
    gynecologicalObstetricHistory: 'narrative',
    behavioralHabits: 'narrative',
    treatmentExpectations: 'narrative',
    additionalNotes: 'narrative',
  },
  PREGNANCY: {
    gestationalData: 'structured',
    obstetricHistory: 'narrative',
    currentPregnancyHistory: 'narrative',
    ultrasound: 'structured',
    otherExams: 'narrative',
    healthHistory: 'narrative',
    musculoskeletalPelvicSymptoms: 'narrative',
    urinarySymptoms: 'narrative',
    bowelSymptoms: 'narrative',
    sexualSymptoms: 'narrative',
    behavioralHabits: 'narrative',
    birthPlanning: 'narrative',
    physiotherapyGoals: 'narrative',
    additionalNotes: 'narrative',
  },
};

const MAX_NARRATIVE_LENGTH = 20000;
const MAX_STRUCTURED_LENGTH = 50000;
const OBSTETRIC_RISKS = ['HABITUAL', 'ALTO_RISCO', 'NAO_INFORMADO'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const isBlank = (value: unknown) => value === undefined || value === null || value === '';

function validateGestationalData(value: PlainObject): void {
  for (const key of ['dum', 'dpp'] as const) {
    const field = value[key];
    if (!isBlank(field) && !(typeof field === 'string' && isValidIsoDate(field))) {
      throw new BadRequestException(`gestationalData.${key} deve ser uma data válida (YYYY-MM-DD)`);
    }
  }
  const risk = value.obstetricRisk;
  if (!isBlank(risk) && !(typeof risk === 'string' && OBSTETRIC_RISKS.includes(risk))) {
    throw new BadRequestException('gestationalData.obstetricRisk inválido');
  }
}

export function normalizeAnamnesisData(
  type: AnamnesisType,
  data: unknown,
): { sections: Record<string, unknown> } {
  if (data === undefined) return { sections: {} };
  if (!isPlainObject(data)) {
    throw new BadRequestException('Dados da anamnese inválidos');
  }

  const extraKeys = Object.keys(data).filter((key) => key !== 'sections');
  if (extraKeys.length > 0) {
    throw new BadRequestException(`Campos desconhecidos em data: ${extraKeys.join(', ')}`);
  }

  const sections = data.sections ?? {};
  if (!isPlainObject(sections)) {
    throw new BadRequestException('data.sections deve ser um objeto');
  }

  const definitions = ANAMNESIS_SECTIONS[type];
  for (const [id, value] of Object.entries(sections)) {
    // hasOwnProperty: "constructor"/"__proto__" must not resolve through Object.prototype
    if (!Object.prototype.hasOwnProperty.call(definitions, id)) {
      throw new BadRequestException(`Seção desconhecida para este tipo de anamnese: ${id}`);
    }

    if (definitions[id] === 'narrative') {
      if (typeof value !== 'string') {
        throw new BadRequestException(`Seção ${id} deve ser um texto`);
      }
      if (value.length > MAX_NARRATIVE_LENGTH) {
        throw new BadRequestException(`Seção ${id} excede ${MAX_NARRATIVE_LENGTH} caracteres`);
      }
      continue;
    }

    if (!isPlainObject(value)) {
      throw new BadRequestException(`Seção ${id} deve ser um objeto`);
    }
    if (JSON.stringify(value).length > MAX_STRUCTURED_LENGTH) {
      throw new BadRequestException(`Seção ${id} é grande demais`);
    }
    if (id === 'gestationalData') validateGestationalData(value);
  }

  return { sections };
}

export function extractSections(data: unknown): Record<string, unknown> {
  if (isPlainObject(data) && isPlainObject(data.sections)) return data.sections;
  return {};
}
