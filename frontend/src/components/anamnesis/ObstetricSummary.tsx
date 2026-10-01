import {
  currentGestationalAge,
  formatGestationalAgeShort,
  formatIsoDate,
  todayIso,
} from '@/lib/gestational-age';
import {
  FETAL_PRESENTATION_LABELS,
  OBSTETRIC_RISK_LABELS,
  type GestationalData,
  type UltrasoundData,
} from './gestational-data';

function Cell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-[15px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </dd>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function ObstetricSummary({
  gestational, ultrasound, assessmentDate, today,
}: {
  gestational: GestationalData;
  ultrasound: UltrasoundData;
  assessmentDate: string;
  today?: string;
}) {
  const manual = gestational.gestationalAge?.manualOverride ? gestational.gestationalAge : undefined;
  const ga = currentGestationalAge({
    dpp: gestational.dpp,
    manual: manual && { weeks: manual.weeks, days: manual.days },
    assessmentDate,
    today: today ?? todayIso(),
  });

  const presentation = ultrasound.fetalPresentation
    ? ultrasound.fetalPresentation === 'OUTRO'
      ? ultrasound.fetalPresentationOther?.trim() || FETAL_PRESENTATION_LABELS.OUTRO
      : FETAL_PRESENTATION_LABELS[ultrasound.fetalPresentation]
    : '—';
  const examDate = formatIsoDate(ultrasound.date);

  return (
    <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-secondary/40 p-4 sm:grid-cols-4">
      <Cell label="IG atual" value={ga ? formatGestationalAgeShort(ga) : '—'} />
      <Cell label="DPP" value={formatIsoDate(gestational.dpp) || '—'} />
      <Cell
        label="Apresentação"
        value={presentation}
        hint={ultrasound.fetalPresentation && examDate ? `ultrassonografia de ${examDate}` : undefined}
      />
      <Cell
        label="Risco obstétrico"
        value={gestational.obstetricRisk ? OBSTETRIC_RISK_LABELS[gestational.obstetricRisk] : '—'}
      />
    </dl>
  );
}
