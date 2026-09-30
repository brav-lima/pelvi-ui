import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePatientDto } from './create-patient.dto';
import { UpdatePatientDto } from './update-patient.dto';

describe('Patient DTOs — occupation / maritalStatus', () => {
  it('CreatePatientDto aceita profissão e estado civil válidos', async () => {
    const dto = plainToInstance(CreatePatientDto, {
      name: 'Maria Silva',
      occupation: 'Professora',
      maritalStatus: 'MARRIED',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('CreatePatientDto rejeita estado civil fora da lista', async () => {
    const dto = plainToInstance(CreatePatientDto, { name: 'Maria Silva', maritalStatus: 'CASADA' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('maritalStatus');
  });

  it('CreatePatientDto rejeita profissão com mais de 120 caracteres', async () => {
    const dto = plainToInstance(CreatePatientDto, { name: 'Maria Silva', occupation: 'x'.repeat(121) });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('occupation');
  });

  it('UpdatePatientDto valida os mesmos campos', async () => {
    const ok = plainToInstance(UpdatePatientDto, { occupation: 'Médica', maritalStatus: 'STABLE_UNION' });
    expect(await validate(ok)).toHaveLength(0);

    const bad = plainToInstance(UpdatePatientDto, { maritalStatus: 'XYZ' });
    const errors = await validate(bad);
    expect(errors.map((e) => e.property)).toContain('maritalStatus');
  });
});
