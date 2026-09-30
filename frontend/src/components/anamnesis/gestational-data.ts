import {
  dppFromDum,
  dppFromUltrasound,
  gaFromDpp,
  gaFromDum,
} from '@/lib/gestational-age';
import { asRecord } from './anamnesis-forms';

export type GaSource = 'DUM' | 'ULTRASSONOGRAFIA' | 'MANUAL';
export type ObstetricRisk = 'HABITUAL' | 'ALTO_RISCO' | 'NAO_INFORMADO';
export type PregnancyType = 'UNICA' | 'MULTIPLA';
export type Conception = 'ESPONTANEA' | 'REPRODUCAO_ASSISTIDA';
export type FetalPresentation =
  | 'CEFALICA' | 'PELVICA' | 'TRANSVERSA' | 'OBLIQUA' | 'NAO_INFORMADO' | 'OUTRO';

export interface GestationalData {
  dum?: string;
  dpp?: string;
  /** Where the current DPP came from. MANUAL = typed by the professional (never auto-overwritten). */
  dppSource?: GaSource;
  /** Selected source for the gestational age. Defaults to DUM when absent. */
  gaSource?: GaSource;
  /** GA on the assessment date. manualOverride=true when typed by the professional. */
  gestationalAge?: { weeks: number; days: number; manualOverride: boolean };
  pregnancyType?: PregnancyType;
  conception?: Conception;
  obstetricRisk?: ObstetricRisk;
}

export interface UltrasoundData {
  date?: string;
  gaAtExam?: { weeks?: number; days?: number };
  estimatedFetalWeight?: string;
  fetalPercentile?: string;
  fetalPresentation?: FetalPresentation;
  fetalPresentationOther?: string;
  placentaLocation?: string;
  cervicalLength?: string;
  amnioticFluid?: string;
}

export interface RecomputeContext {
  /** YYYY-MM-DD — reference date for the GA stored in the record. */
  assessmentDate: string;
  ultrasound?: UltrasoundData;
}

export const GA_SOURCE_LABELS: Record<GaSource, string> = {
  DUM: 'DUM',
  ULTRASSONOGRAFIA: 'Ultrassonografia',
  MANUAL: 'Manual',
};
export const OBSTETRIC_RISK_LABELS: Record<ObstetricRisk, string> = {
  HABITUAL: 'Habitual',
  ALTO_RISCO: 'Alto risco',
  NAO_INFORMADO: 'Não informado',
};
export const PREGNANCY_TYPE_LABELS: Record<PregnancyType, string> = {
  UNICA: 'Única',
  MULTIPLA: 'Múltipla',
};
export const CONCEPTION_LABELS: Record<Conception, string> = {
  ESPONTANEA: 'Espontânea',
  REPRODUCAO_ASSISTIDA: 'Reprodução assistida',
};
export const FETAL_PRESENTATION_LABELS: Record<FetalPresentation, string> = {
  CEFALICA: 'Cefálica',
  PELVICA: 'Pélvica',
  TRANSVERSA: 'Transversa',
  OBLIQUA: 'Oblíqua',
  NAO_INFORMADO: 'Não informado',
  OUTRO: 'Outro',
};

export const asGestationalData = (value: unknown): GestationalData =>
  asRecord(value) as GestationalData;
export const asUltrasound = (value: unknown): UltrasoundData => asRecord(value) as UltrasoundData;

function ultrasoundDpp(us?: UltrasoundData): string | null {
  const ga = us?.gaAtExam;
  if (!us?.date || ga?.weeks === undefined || ga?.days === undefined) return null;
  return dppFromUltrasound(us.date, { weeks: ga.weeks, days: ga.days });
}

/** DPP the active source would produce, ignoring any manual DPP. */
export function calculatedDpp(data: GestationalData, ctx: RecomputeContext): string | null {
  const source = data.gaSource ?? 'DUM';
  if (source === 'DUM') return dppFromDum(data.dum);
  if (source === 'ULTRASSONOGRAFIA') return ultrasoundDpp(ctx.ultrasound);
  return null;
}

/**
 * Recomputes the derived fields (DPP, GA on the assessment date) from the active
 * source. Never overwrites: a MANUAL source (manual GA), or a manually typed DPP.
 */
export function recomputeGestational(data: GestationalData, ctx: RecomputeContext): GestationalData {
  const source = data.gaSource ?? 'DUM';
  if (source === 'MANUAL') return data;

  const next: GestationalData = { ...data };

  if (next.dppSource !== 'MANUAL') {
    const dpp = calculatedDpp(next, ctx);
    if (dpp) {
      next.dpp = dpp;
      next.dppSource = source;
    } else {
      delete next.dpp;
      delete next.dppSource;
    }
  }

  const ga =
    source === 'DUM'
      ? gaFromDum(next.dum, ctx.assessmentDate)
      : gaFromDpp(next.dpp, ctx.assessmentDate);
  if (ga) next.gestationalAge = { ...ga, manualOverride: false };
  else delete next.gestationalAge;

  return next;
}

export function changeGaSource(
  data: GestationalData,
  source: GaSource,
  ctx: RecomputeContext,
): GestationalData {
  if (source === 'MANUAL') {
    return {
      ...data,
      gaSource: 'MANUAL',
      gestationalAge: data.gestationalAge ? { ...data.gestationalAge, manualOverride: true } : undefined,
    };
  }
  return recomputeGestational({ ...data, gaSource: source }, ctx);
}

export function editDpp(data: GestationalData, dpp: string, ctx: RecomputeContext): GestationalData {
  const next: GestationalData = { ...data, dpp: dpp || undefined, dppSource: dpp ? 'MANUAL' : undefined };
  return recomputeGestational(next, ctx);
}

export function applyCalculatedDpp(data: GestationalData, ctx: RecomputeContext): GestationalData {
  return recomputeGestational({ ...data, dppSource: undefined }, ctx);
}

export function setManualGa(data: GestationalData, weeks: number, days: number): GestationalData {
  return { ...data, gaSource: 'MANUAL', gestationalAge: { weeks, days, manualOverride: true } };
}
