import { Test, TestingModule } from '@nestjs/testing';
import { PatientAccountService } from './patient-account.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PatientAccountService', () => {
  let service: PatientAccountService;
  let prisma: {
    patientAccount: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      patientAccount: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PatientAccountService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PatientAccountService>(PatientAccountService);
  });

  it('busca conta por CPF', async () => {
    prisma.patientAccount.findUnique.mockResolvedValue({ id: 'acc-1', cpf: '12345678901' });

    const result = await service.findByCpf('12345678901');

    expect(result).toEqual({ id: 'acc-1', cpf: '12345678901' });
    expect(prisma.patientAccount.findUnique).toHaveBeenCalledWith({ where: { cpf: '12345678901' } });
  });

  it('retorna null quando o CPF não tem conta', async () => {
    prisma.patientAccount.findUnique.mockResolvedValue(null);

    expect(await service.findByCpf('00000000000')).toBeNull();
  });

  it('cria uma conta pendente sem senha', async () => {
    prisma.patientAccount.create.mockResolvedValue({ id: 'acc-1', cpf: '12345678901', passwordHash: null });

    const result = await service.createPending('12345678901');

    expect(prisma.patientAccount.create).toHaveBeenCalledWith({
      data: { cpf: '12345678901' },
    });
    expect(result.passwordHash).toBeNull();
  });

  it('ativa a conta gravando o hash de senha e activatedAt', async () => {
    prisma.patientAccount.update.mockResolvedValue({ id: 'acc-1', activatedAt: new Date() });

    await service.activate('acc-1', 'hashed-password');

    expect(prisma.patientAccount.update).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
      data: { passwordHash: 'hashed-password', activatedAt: expect.any(Date) },
    });
  });
});
