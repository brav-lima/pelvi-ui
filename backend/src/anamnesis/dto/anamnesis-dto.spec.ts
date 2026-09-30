import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAnamnesisDto } from './create-anamnesis.dto';
import { UpdateAnamnesisDto } from './update-anamnesis.dto';

const PATIENT = '3f2b8c1e-5d4a-4b6c-8e7f-1a2b3c4d5e6f';
const props = async (cls: any, plain: object) =>
  (await validate(plainToInstance(cls, plain))).map((e) => e.property);

describe('CreateAnamnesisDto', () => {
  const base = { patientId: PATIENT, type: 'PELVIC_GENERAL' };

  it('aceita apenas campos obrigatórios (opcionais undefined)', async () => {
    expect(await props(CreateAnamnesisDto, base)).toEqual([]);
  });

  it('aceita valores válidos', async () => {
    expect(
      await props(CreateAnamnesisDto, {
        ...base,
        assessmentDate: '2026-06-10',
        data: { sections: {} },
      }),
    ).toEqual([]);
  });

  it('rejeita null em assessmentDate e data', async () => {
    expect(await props(CreateAnamnesisDto, { ...base, assessmentDate: null })).toContain('assessmentDate');
    expect(await props(CreateAnamnesisDto, { ...base, data: null })).toContain('data');
  });

  it('type continua obrigatório', async () => {
    expect(await props(CreateAnamnesisDto, { patientId: PATIENT })).toContain('type');
    expect(await props(CreateAnamnesisDto, { ...base, type: 'OUTRO' })).toContain('type');
  });
});

describe('UpdateAnamnesisDto', () => {
  it('aceita corpo vazio', async () => {
    expect(await props(UpdateAnamnesisDto, {})).toEqual([]);
  });

  it('aceita valores válidos', async () => {
    expect(
      await props(UpdateAnamnesisDto, {
        data: { sections: {} },
        assessmentDate: '2026-06-10',
        status: 'COMPLETED',
      }),
    ).toEqual([]);
  });

  it('rejeita null em data, assessmentDate e status', async () => {
    expect(await props(UpdateAnamnesisDto, { data: null })).toContain('data');
    expect(await props(UpdateAnamnesisDto, { assessmentDate: null })).toContain('assessmentDate');
    expect(await props(UpdateAnamnesisDto, { status: null })).toContain('status');
  });
});
