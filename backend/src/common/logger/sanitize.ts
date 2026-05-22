// Regex patterns for Brazilian PII
const CPF_RE = /\d{3}[.\s]\d{3}[.\s]\d{3}[-\s]\d{2}/g;
const CNPJ_RE = /\d{2}[.\s]\d{3}[.\s]\d{3}[/\s]\d{4}[-\s]\d{2}/g;
const PHONE_RE = /\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]\d{4}/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Object keys whose values are always redacted regardless of format
const SENSITIVE_KEYS = new Set([
  'cpf', 'cnpj', 'phone', 'telefone', 'celular',
  'document', 'documento', 'rg',
  'password', 'senha', 'token', 'refreshtoken', 'accesstoken',
  'email', 'name', 'nome', 'address', 'endereco', 'endereço',
]);

function sanitizeString(value: string): string {
  return value
    .replace(CPF_RE, '[CPF]')
    .replace(CNPJ_RE, '[CNPJ]')
    .replace(PHONE_RE, '[PHONE]')
    .replace(EMAIL_RE, '[EMAIL]');
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, sanitizeValue(k, v)]),
  );
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) return '[REDACTED]';
  if (typeof value === 'string') return sanitizeString(value);
  if (Array.isArray(value)) return value.map((item, i) => sanitizeValue(String(i), item));
  if (value !== null && typeof value === 'object')
    return sanitizeObject(value as Record<string, unknown>);
  return value;
}

export function sanitize(message: unknown): string {
  if (typeof message === 'string') return sanitizeString(message);
  if (message !== null && typeof message === 'object') {
    try {
      return JSON.stringify(sanitizeObject(message as Record<string, unknown>));
    } catch {
      return '[unserializable object]';
    }
  }
  return String(message ?? '');
}
