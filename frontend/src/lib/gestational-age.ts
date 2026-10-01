export interface GestationalAge {
  weeks: number;
  days: number;
}

const DAY_MS = 86_400_000;
const GESTATION_DAYS = 280;
const MAX_TOTAL_DAYS = 45 * 7;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIso(iso?: string | null): number | null {
  if (!iso || !ISO_DATE.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d);
  return new Date(ms).toISOString().slice(0, 10) === iso ? ms : null;
}

function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function isValidGa(ga?: GestationalAge | null): ga is GestationalAge {
  return (
    !!ga &&
    Number.isInteger(ga.weeks) &&
    Number.isInteger(ga.days) &&
    ga.weeks >= 0 &&
    ga.days >= 0 &&
    ga.days <= 6 &&
    ga.weeks * 7 + ga.days <= MAX_TOTAL_DAYS
  );
}

const totalDays = (ga: GestationalAge) => ga.weeks * 7 + ga.days;

function toGa(total: number): GestationalAge | null {
  if (!Number.isInteger(total) || total < 0 || total > MAX_TOTAL_DAYS) return null;
  return { weeks: Math.floor(total / 7), days: total % 7 };
}

export function dppFromDum(dum?: string): string | null {
  const t = parseIso(dum);
  return t === null ? null : toIso(t + GESTATION_DAYS * DAY_MS);
}

export function gaFromDum(dum?: string, reference?: string): GestationalAge | null {
  const d = parseIso(dum);
  const r = parseIso(reference);
  if (d === null || r === null) return null;
  return toGa((r - d) / DAY_MS);
}

export function gaFromDpp(dpp?: string, reference?: string): GestationalAge | null {
  const d = parseIso(dpp);
  const r = parseIso(reference);
  if (d === null || r === null) return null;
  return toGa(GESTATION_DAYS - (d - r) / DAY_MS);
}

export function dppFromUltrasound(examDate?: string, gaAtExam?: GestationalAge): string | null {
  const e = parseIso(examDate);
  if (e === null || !isValidGa(gaAtExam)) return null;
  return toIso(e + (GESTATION_DAYS - totalDays(gaAtExam)) * DAY_MS);
}

export function currentGestationalAge(input: {
  dpp?: string;
  manual?: GestationalAge;
  assessmentDate?: string;
  today: string;
}): GestationalAge | null {
  const { dpp, manual, assessmentDate, today } = input;
  if (manual) {
    if (!isValidGa(manual)) return null;
    const from = parseIso(assessmentDate ?? today);
    const to = parseIso(today);
    if (from === null || to === null) return toGa(totalDays(manual));
    return toGa(totalDays(manual) + (to - from) / DAY_MS);
  }
  return dpp ? gaFromDpp(dpp, today) : null;
}

export function formatGestationalAge(ga: GestationalAge): string {
  const w = `${ga.weeks} ${ga.weeks === 1 ? 'semana' : 'semanas'}`;
  const d = `${ga.days} ${ga.days === 1 ? 'dia' : 'dias'}`;
  return `${w} + ${d}`;
}

export function formatGestationalAgeShort(ga: GestationalAge): string {
  return `${ga.weeks}s + ${ga.days}d`;
}

export function formatIsoDate(iso?: string): string {
  if (parseIso(iso) === null) return '';
  const [y, m, d] = (iso as string).split('-');
  return `${d}/${m}/${y}`;
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
