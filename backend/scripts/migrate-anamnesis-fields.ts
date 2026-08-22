// backend/scripts/migrate-anamnesis-fields.ts
import { config } from 'dotenv';

config({ path: `.env.${process.env.NODE_ENV || 'dev'}` });

import { writeFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const FIELD_KEYS = ['queixaPrincipal', 'impacto', 'historiaAtual', 'historiaPregressa'] as const;
type FieldKey = typeof FIELD_KEYS[number];

interface AnamnesisFieldData {
  texto: string;
  hipoteses: string[];
}

type AnamnesisData = Record<FieldKey, AnamnesisFieldData>;

function emptyAnamnesisData(): AnamnesisData {
  return {
    queixaPrincipal: { texto: '', hipoteses: [] },
    impacto: { texto: '', hipoteses: [] },
    historiaAtual: { texto: '', hipoteses: [] },
    historiaPregressa: { texto: '', hipoteses: [] },
  };
}

export function formatKey(key: string): string {
  const result = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// Maps each section id from the old 5-template wizard to the new field it
// belongs under. See docs/superpowers/specs/2026-08-21-anamnese-simplificada-design.md.
const SECTION_TARGET_MAP: Record<string, FieldKey> = {
  queixaPrincipal: 'queixaPrincipal',
  impacto: 'impacto',
  molestiaAtual: 'historiaAtual',
  funcaoArmazenamento: 'historiaAtual',
  perdaUrinaria: 'historiaAtual',
  funcaoIntestinal: 'historiaAtual',
  molestiaPregressa: 'historiaPregressa',
  habiConclusao: 'historiaPregressa',
  habitos: 'historiaPregressa',
  conclusao: 'historiaPregressa',
  dadosGestacionais: 'historiaAtual',
  queixasAtuais: 'queixaPrincipal',
  habitosMedicacoes: 'historiaPregressa',
  funcoesPelvicas: 'historiaAtual',
  testesMovilidade: 'historiaPregressa',
  dadosObstetricos: 'historiaPregressa',
  queixasImpacto: 'queixaPrincipal',
  exameFisico: 'historiaPregressa',
  avaliacaoAbdominal: 'historiaAtual',
};

// Section labels from the even-older AnamnesisFormDialog format (no _template key).
const LEGACY_SECTION_TARGET_MAP: Record<string, FieldKey> = {
  'Queixa Principal': 'queixaPrincipal',
  'Historico Medico': 'historiaPregressa',
  'Habitos de Vida': 'historiaPregressa',
};

export function flattenSection(
  section: Record<string, unknown>,
  excludeKeys: string[] = [],
  formatLabel = true,
): string {
  return Object.entries(section)
    .filter(([k, v]) => {
      if (excludeKeys.includes(k)) return false;
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      return String(v).trim() !== '';
    })
    .map(([k, v]) => `${formatLabel ? formatKey(k) : k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
}

export function migrateData(data: Record<string, unknown>): AnamnesisData {
  const result = emptyAnamnesisData();
  const texts: Record<FieldKey, string[]> = {
    queixaPrincipal: [], impacto: [], historiaAtual: [], historiaPregressa: [],
  };

  if ('_template' in data) {
    for (const [sectionId, sectionValue] of Object.entries(data)) {
      if (sectionId === '_template') continue;
      if (typeof sectionValue !== 'object' || sectionValue === null) continue;
      const section = sectionValue as Record<string, unknown>;
      const target = SECTION_TARGET_MAP[sectionId] ?? 'historiaPregressa';

      if (typeof section.hipoteses === 'string' && section.hipoteses.trim() !== '') {
        result.historiaAtual.hipoteses.push(section.hipoteses.trim());
      }

      const text = flattenSection(section, ['hipoteses']);
      if (text) texts[target].push(`[${formatKey(sectionId)}]\n${text}`);
    }
  } else {
    for (const [sectionLabel, sectionValue] of Object.entries(data)) {
      if (sectionLabel === 'Observacoes Gerais') {
        if (typeof sectionValue === 'string' && sectionValue.trim() !== '') {
          texts.historiaPregressa.push(`[Observações Gerais]\n${sectionValue.trim()}`);
        }
        continue;
      }
      const target = LEGACY_SECTION_TARGET_MAP[sectionLabel] ?? 'historiaPregressa';
      if (typeof sectionValue === 'object' && sectionValue !== null) {
        const text = flattenSection(sectionValue as Record<string, unknown>, [], false);
        if (text) texts[target].push(`[${sectionLabel}]\n${text}`);
      }
    }
  }

  for (const key of FIELD_KEYS) {
    result[key].texto = texts[key].join('\n\n');
  }
  return result;
}

// Detects records already in the new 4-field shape, so re-running --apply on an
// already-migrated table is a no-op instead of falling into the legacy branch
// and mangling already-correct data.
function isAlreadyMigrated(data: Record<string, unknown>): boolean {
  if ('_template' in data) return false;
  return FIELD_KEYS.every((key) => {
    const v = data[key];
    return (
      !!v &&
      typeof v === 'object' &&
      typeof (v as AnamnesisFieldData).texto === 'string' &&
      Array.isArray((v as AnamnesisFieldData).hipoteses)
    );
  });
}

interface BackupRecord {
  id: string;
  patientId: string;
  before: unknown;
  skipped?: boolean;
  after?: AnamnesisData;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const anamneses = await prisma.anamnesis.findMany();

  console.log(`Encontradas ${anamneses.length} anamneses. Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  // Safety net: dump the full "before" state of every record to a local backup
  // file BEFORE any writes happen (even in dry-run). Restorable if the
  // migration goes wrong. Also holds ANTES/DEPOIS detail instead of stdout,
  // since anamnesis data is LGPD Art. 11 sensitive health data.
  const backupPath = `migrate-anamnesis-fields-backup-${Date.now()}.json`;
  const backupRecords: BackupRecord[] = anamneses.map((a) => ({
    id: a.id,
    patientId: a.patientId,
    before: a.data,
  }));
  writeFileSync(backupPath, JSON.stringify(backupRecords, null, 2));
  console.log(`Backup salvo em ${backupPath}`);

  const updates: { id: string; after: AnamnesisData }[] = [];

  for (let i = 0; i < anamneses.length; i++) {
    const anamnesis = anamneses[i];
    const before = anamnesis.data as Record<string, unknown>;
    const record = backupRecords[i];

    const skipped = isAlreadyMigrated(before);

    if (!skipped) {
      const after = migrateData(before);
      record.after = after;
      if (apply) {
        updates.push({ id: anamnesis.id, after });
      }
    } else {
      record.skipped = true;
    }

    console.log(
      `Anamnesis ${anamnesis.id}: ${apply ? 'migrado' : 'seria migrado'} (${skipped ? 'pulado, já migrado' : 'ok'})`,
    );
  }

  // Re-write the backup file now that it also carries ANTES/DEPOIS detail.
  writeFileSync(backupPath, JSON.stringify(backupRecords, null, 2));

  if (apply && updates.length > 0) {
    await prisma.$transaction(
      updates.map((u) =>
        prisma.anamnesis.update({
          where: { id: u.id },
          data: { data: u.after as object },
        }),
      ),
    );
  }

  console.log(
    `\n${apply ? 'Aplicado' : 'Simulado'} em ${updates.length} registro(s), ${anamneses.length - updates.length} pulado(s)/sem alteração (total ${anamneses.length}).`,
  );
}

// Guards main() so importing this module (e.g. from the jest spec) doesn't
// trigger a real run against the DB. `require.main === module` is true only
// when this file is the process entry point — Bun fully implements Node's
// CJS module semantics, so this works identically under `bun scripts/...`.
// (import.meta.main would be the more idiomatic Bun-only check, but this
// project's backend tsconfig has no `"type": "module"`, so .ts files compile
// as CommonJS and `import.meta` is a TS1470 compile error there — this
// require.main form is the CommonJS-safe equivalent, needed so both
// `bunx tsc --noEmit` and ts-jest importing this file for tests stay clean.)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
