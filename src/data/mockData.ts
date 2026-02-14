import type {
  User, Clinic, Patient,
} from '@/types/clinic';

export const mockUser: User = {
  id: '1',
  name: 'Dr. Maria Silva',
  email: 'maria.silva@clinica.com',
  cpf: '12345678900',
  role: 'ADMIN',
};

export const mockClinics: Clinic[] = [
  {
    id: '1',
    name: 'Clinica Saude & Vida',
  },
  {
    id: '2',
    name: 'Centro Medico Esperanca',
  },
];

export const mockPatients: Patient[] = [
  {
    id: '1',
    name: 'Joao Pedro Almeida',
    email: 'joao.almeida@email.com',
    phone: '(11) 98765-4321',
    cpf: '11122233344',
    birthDate: '1985-03-15',
    gender: 'M',
    address: 'Rua das Flores, 123 - Sao Paulo, SP',
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: '2024-01-10T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Marina Santos Lima',
    email: 'marina.lima@email.com',
    phone: '(11) 91234-5678',
    cpf: '22233344455',
    birthDate: '1990-07-22',
    gender: 'F',
    address: 'Av. Brasil, 456 - Sao Paulo, SP',
    createdAt: '2024-02-05T00:00:00.000Z',
    updatedAt: '2024-02-05T00:00:00.000Z',
  },
  {
    id: '3',
    name: 'Roberto Carlos Souza',
    email: 'roberto.souza@email.com',
    phone: '(11) 94567-8901',
    cpf: '33344455566',
    birthDate: '1978-11-08',
    gender: 'M',
    address: 'Rua Consolacao, 789 - Sao Paulo, SP',
    createdAt: '2024-01-20T00:00:00.000Z',
    updatedAt: '2024-01-20T00:00:00.000Z',
  },
];
