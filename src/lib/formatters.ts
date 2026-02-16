// ── Masks (for input fields — strips non-digits and applies pattern) ──

export function maskCPF(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  return numbers
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function maskPhone(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 2) return numbers.replace(/(\d{2})/, '($1');
  if (numbers.length <= 7) return numbers.replace(/(\d{2})(\d+)/, '($1) $2');
  return numbers.replace(/(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
}

export function maskCurrency(value: string): string {
  // Allow only digits and one comma/dot for decimal
  const clean = value.replace(/[^\d,]/g, '');
  const parts = clean.split(',');
  // integer part with thousand separator
  let intPart = parts[0].replace(/\D/g, '');
  if (intPart.length > 1) intPart = intPart.replace(/^0+/, '') || '0';
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (parts.length > 1) {
    return `${formatted},${parts[1].slice(0, 2)}`;
  }
  return formatted;
}

/** Parses a masked currency string ("1.234,56") back to a number */
export function parseCurrency(masked: string): number {
  const clean = masked.replace(/\./g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

// ── Formatters (for display — takes raw value and returns formatted string) ──

export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length !== 11) return cpf; // return as-is if not 11 digits
  return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatCPFMasked(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const numbers = cpf.replace(/\D/g, '');
  if (numbers.length !== 11) return cpf;
  return `***.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-**`;
}

export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const numbers = cnpj.replace(/\D/g, '');
  if (numbers.length !== 14) return cnpj;
  return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const numbers = phone.replace(/\D/g, '');
  if (numbers.length === 11) {
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (numbers.length === 10) {
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

export function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
