// backend/scripts/migrate-anamnesis-fields.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

function formatKey(key: string): string {
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

function flattenSection(
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

function migrateData(data: Record<string, unknown>): AnamnesisData {
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

async function main() {
  const apply = process.argv.includes('--apply');
  const anamneses = await prisma.anamnesis.findMany();

  console.log(`Encontradas ${anamneses.length} anamneses. Modo: ${apply ? 'APPLY' : 'DRY-RUN'}`);

  for (const anamnesis of anamneses) {
    const before = anamnesis.data as Record<string, unknown>;
    const after = migrateData(before);

    console.log(`\n--- Anamnesis ${anamnesis.id} (paciente ${anamnesis.patientId}) ---`);
    console.log('ANTES:', JSON.stringify(before, null, 2));
    console.log('DEPOIS:', JSON.stringify(after, null, 2));

    if (apply) {
      await prisma.anamnesis.update({
        where: { id: anamnesis.id },
        data: { data: after as object },
      });
    }
  }

  console.log(`\n${apply ? 'Aplicado' : 'Simulado'} em ${anamneses.length} registro(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
