export type BusinessHour = {
  day: string;
  from: string | null;
  to: string | null;
  enabled: boolean;
};

// Índice alinhado com Date.getDay(): 0 = domingo
const DAY_KEYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function getBusinessHourForDate(
  date: Date,
  bh: BusinessHour[] | undefined,
): BusinessHour | null {
  if (!bh) return null;
  const key = DAY_KEYS[date.getDay()];
  return bh.find(h => h.day === key) ?? null;
}

/**
 * Retorna true se o slot (HH:MM) está fora do horário de funcionamento para a data.
 * - Dia desabilitado → sempre bloqueado
 * - businessHours ausente → nunca bloqueado (fallback seguro)
 * - from/to ausentes → nunca bloqueado (sem restrição configurada)
 */
export function isSlotBlocked(
  slotTime: string,
  date: Date,
  bh: BusinessHour[] | undefined,
): boolean {
  const rule = getBusinessHourForDate(date, bh);
  if (!rule) return false; // No business hours defined → never blocked (safe fallback)
  if (!rule.enabled) return true; // Day disabled → always blocked
  if (!rule.from || !rule.to) return false; // No time restriction → never blocked
  return slotTime < rule.from || slotTime >= rule.to;
}
