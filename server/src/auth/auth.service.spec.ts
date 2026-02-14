import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PersonService } from '../person/person.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { person: any; organizationUser: any };
  let personService: { findOrganizations: jest.Mock };
  let jwtService: { sign: jest.Mock };

  beforeEach(async () => {
    prisma = {
      person: { findUnique: jest.fn() },
      organizationUser: { findUnique: jest.fn() },
    };
    personService = { findOrganizations: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('mock-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PersonService, useValue: personService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    const hashedPassword = bcrypt.hashSync('senha123', 10);
    const mockPerson = {
      id: 'person-1',
      cpf: '12345678901',
      name: 'João',
      email: 'joao@email.com',
      passwordHash: hashedPassword,
      active: true,
    };

    it('deve retornar token quando há apenas uma clínica', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      personService.findOrganizations.mockResolvedValue([
        {
          id: 'org-user-1',
          role: 'ADMIN',
          organization: { id: 'org-1', name: 'Clínica A' },
        },
      ]);

      const result = await service.login({
        cpf: '12345678901',
        password: 'senha123',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.person.id).toBe('person-1');
      expect(result.organization).toBeDefined();
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'person-1',
        organizationId: 'org-1',
        role: 'ADMIN',
      });
    });

    it('deve retornar lista de organizações quando há múltiplas', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      personService.findOrganizations.mockResolvedValue([
        {
          id: 'org-user-1',
          role: 'ADMIN',
          organization: { id: 'org-1', name: 'Clínica A' },
        },
        {
          id: 'org-user-2',
          role: 'PROFESSIONAL',
          organization: { id: 'org-2', name: 'Clínica B' },
        },
      ]);

      const result = await service.login({
        cpf: '12345678901',
        password: 'senha123',
      });

      expect(result.accessToken).toBeNull();
      expect(result.organizations).toHaveLength(2);
    });

    it('deve rejeitar CPF inexistente', async () => {
      prisma.person.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ cpf: '00000000000', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar senha incorreta', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);

      await expect(
        service.login({ cpf: '12345678901', password: 'errada' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar usuário inativo', async () => {
      prisma.person.findUnique.mockResolvedValue({
        ...mockPerson,
        active: false,
      });

      await expect(
        service.login({ cpf: '12345678901', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve rejeitar quando não há clínicas vinculadas', async () => {
      prisma.person.findUnique.mockResolvedValue(mockPerson);
      personService.findOrganizations.mockResolvedValue([]);

      await expect(
        service.login({ cpf: '12345678901', password: 'senha123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('selectOrganization', () => {
    it('deve gerar token para vínculo válido', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: true,
        role: 'ADMIN',
        person: { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com' },
        organization: { id: 'org-1', name: 'Clínica A' },
      });

      const result = await service.selectOrganization({
        personId: 'person-1',
        organizationId: 'org-1',
      });

      expect(result.accessToken).toBe('mock-token');
    });

    it('deve rejeitar vínculo inativo', async () => {
      prisma.organizationUser.findUnique.mockResolvedValue({
        active: false,
        role: 'ADMIN',
        person: { id: 'person-1', cpf: '12345678901', name: 'João', email: 'j@e.com' },
        organization: { id: 'org-1', name: 'Clínica A' },
      });

      await expect(
        service.selectOrganization({
          personId: 'person-1',
          organizationId: 'org-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
