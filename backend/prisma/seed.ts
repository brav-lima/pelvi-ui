import { PrismaClient, Role, AppointmentStatus, FinancialType, FinancialStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ── Organizations ──
  const clinicA = await prisma.organization.upsert({
    where: { document: '12345678000100' },
    update: {},
    create: {
      name: 'Clínica Bem Estar',
      document: '12345678000100',
      settings: { timezone: 'America/Sao_Paulo' },
    },
  });

  const clinicB = await prisma.organization.upsert({
    where: { document: '98765432000100' },
    update: {},
    create: {
      name: 'Centro de Fisioterapia Saúde',
      document: '98765432000100',
      settings: { timezone: 'America/Sao_Paulo' },
    },
  });

  console.log(`Organizations: ${clinicA.name}, ${clinicB.name}`);

  // ── Persons ──
  const passwordHash = await bcrypt.hash('123456', 10);

  const admin = await prisma.person.upsert({
    where: { cpf: '11111111111' },
    update: {},
    create: {
      cpf: '11111111111',
      name: 'Carol Lazzarim',
      email: 'carollazzarim@gmail.com',
      passwordHash,
    },
  });

  const profissional1 = await prisma.person.upsert({
    where: { cpf: '22222222222' },
    update: {},
    create: {
      cpf: '22222222222',
      name: 'Dra. Ana Fisioterapeuta',
      email: 'ana@clinica.com',
      phone: '11999990001',
      passwordHash,
    },
  });

  const profissional2 = await prisma.person.upsert({
    where: { cpf: '33333333333' },
    update: {},
    create: {
      cpf: '33333333333',
      name: 'Dr. Bruno Psicólogo',
      email: 'bruno@clinica.com',
      phone: '11999990002',
      passwordHash,
    },
  });

  const recepcao = await prisma.person.upsert({
    where: { cpf: '44444444444' },
    update: {},
    create: {
      cpf: '44444444444',
      name: 'Maria Recepcionista',
      email: 'maria@clinica.com',
      phone: '11999990003',
      passwordHash,
    },
  });

  console.log(`Persons: ${admin.name}, ${profissional1.name}, ${profissional2.name}, ${recepcao.name}`);

  // ── OrganizationUsers ──
  const orgUserAdmin = await prisma.organizationUser.upsert({
    where: {
      organizationId_personId: {
        organizationId: clinicA.id,
        personId: admin.id,
      },
    },
    update: {},
    create: {
      organizationId: clinicA.id,
      personId: admin.id,
      role: Role.ADMIN,
    },
  });

  const orgUserProf1 = await prisma.organizationUser.upsert({
    where: {
      organizationId_personId: {
        organizationId: clinicA.id,
        personId: profissional1.id,
      },
    },
    update: {},
    create: {
      organizationId: clinicA.id,
      personId: profissional1.id,
      role: Role.PROFESSIONAL,
    },
  });

  const orgUserProf2 = await prisma.organizationUser.upsert({
    where: {
      organizationId_personId: {
        organizationId: clinicA.id,
        personId: profissional2.id,
      },
    },
    update: {},
    create: {
      organizationId: clinicA.id,
      personId: profissional2.id,
      role: Role.PROFESSIONAL,
    },
  });

  await prisma.organizationUser.upsert({
    where: {
      organizationId_personId: {
        organizationId: clinicA.id,
        personId: recepcao.id,
      },
    },
    update: {},
    create: {
      organizationId: clinicA.id,
      personId: recepcao.id,
      role: Role.RECEPTIONIST,
    },
  });

  // Admin also belongs to clinicB (multi-tenant test)
  await prisma.organizationUser.upsert({
    where: {
      organizationId_personId: {
        organizationId: clinicB.id,
        personId: admin.id,
      },
    },
    update: {},
    create: {
      organizationId: clinicB.id,
      personId: admin.id,
      role: Role.ADMIN,
    },
  });

  console.log('OrganizationUsers linked');

  // ── Procedures ──
  const procFisio = await prisma.procedure.create({
    data: {
      organizationId: clinicA.id,
      name: 'Sessão de Fisioterapia',
      durationMinutes: 50,
      price: 150.0,
    },
  });

  const procPsico = await prisma.procedure.create({
    data: {
      organizationId: clinicA.id,
      name: 'Consulta Psicológica',
      durationMinutes: 60,
      price: 200.0,
    },
  });

  const procAvaliacao = await prisma.procedure.create({
    data: {
      organizationId: clinicA.id,
      name: 'Avaliação Inicial',
      durationMinutes: 90,
      price: 250.0,
    },
  });

  console.log(`Procedures: ${procFisio.name}, ${procPsico.name}, ${procAvaliacao.name}`);

  // ── Patients ──
  const patients = await Promise.all([
    prisma.patient.create({
      data: {
        organizationId: clinicA.id,
        name: 'João Silva',
        cpf: '55555555555',
        email: 'joao.silva@email.com',
        phone: '11988880001',
        birthDate: new Date('1985-03-15'),
        gender: 'M',
      },
    }),
    prisma.patient.create({
      data: {
        organizationId: clinicA.id,
        name: 'Ana Souza',
        cpf: '66666666666',
        email: 'ana.souza@email.com',
        phone: '11988880002',
        birthDate: new Date('1990-07-22'),
        gender: 'F',
      },
    }),
    prisma.patient.create({
      data: {
        organizationId: clinicA.id,
        name: 'Pedro Santos',
        cpf: '77777777777',
        email: 'pedro.santos@email.com',
        phone: '11988880003',
        birthDate: new Date('1978-11-08'),
        gender: 'M',
        notes: 'Paciente com histórico de lesão no joelho',
      },
    }),
    prisma.patient.create({
      data: {
        organizationId: clinicA.id,
        name: 'Lucia Oliveira',
        cpf: '88888888888',
        email: 'lucia.oliveira@email.com',
        phone: '11988880004',
        birthDate: new Date('1995-01-30'),
        gender: 'F',
      },
    }),
    prisma.patient.create({
      data: {
        organizationId: clinicA.id,
        name: 'Roberto Ferreira',
        email: 'roberto@email.com',
        phone: '11988880005',
        birthDate: new Date('1960-05-12'),
        gender: 'M',
        addressStreet: 'Rua das Flores',
        addressNumber: '123',
        addressCity: 'São Paulo',
        addressState: 'SP',
      },
    }),
  ]);

  console.log(`Patients: ${patients.length} created`);

  // ── Appointments ──
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1); // This week's Monday

  const appointments = await Promise.all([
    // Monday
    prisma.appointment.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[0].id,
        professionalId: orgUserProf1.id,
        procedureId: procFisio.id,
        startAt: setTime(monday, 8, 0),
        endAt: setTime(monday, 8, 50),
        status: AppointmentStatus.DONE,
      },
    }),
    prisma.appointment.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[1].id,
        professionalId: orgUserProf1.id,
        procedureId: procFisio.id,
        startAt: setTime(monday, 9, 0),
        endAt: setTime(monday, 9, 50),
        status: AppointmentStatus.DONE,
      },
    }),
    prisma.appointment.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[2].id,
        professionalId: orgUserProf2.id,
        procedureId: procPsico.id,
        startAt: setTime(monday, 10, 0),
        endAt: setTime(monday, 11, 0),
        status: AppointmentStatus.CONFIRMED,
      },
    }),
    // Tuesday
    prisma.appointment.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[3].id,
        professionalId: orgUserProf1.id,
        procedureId: procAvaliacao.id,
        startAt: setTime(addDays(monday, 1), 8, 0),
        endAt: setTime(addDays(monday, 1), 9, 30),
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    prisma.appointment.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[4].id,
        professionalId: orgUserProf2.id,
        procedureId: procPsico.id,
        startAt: setTime(addDays(monday, 1), 14, 0),
        endAt: setTime(addDays(monday, 1), 15, 0),
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    // Wednesday
    prisma.appointment.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[0].id,
        professionalId: orgUserProf1.id,
        procedureId: procFisio.id,
        startAt: setTime(addDays(monday, 2), 8, 0),
        endAt: setTime(addDays(monday, 2), 8, 50),
        status: AppointmentStatus.SCHEDULED,
      },
    }),
    // Canceled appointment
    prisma.appointment.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[1].id,
        professionalId: orgUserProf1.id,
        procedureId: procFisio.id,
        startAt: setTime(addDays(monday, 2), 9, 0),
        endAt: setTime(addDays(monday, 2), 9, 50),
        status: AppointmentStatus.CANCELED,
      },
    }),
  ]);

  console.log(`Appointments: ${appointments.length} created`);

  // ── Financial Records ──
  await Promise.all([
    prisma.financialRecord.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[0].id,
        appointmentId: appointments[0].id,
        amount: 150.0,
        type: FinancialType.INCOME,
        status: FinancialStatus.PAID,
        paymentMethod: 'PIX',
        description: 'Sessão de fisioterapia',
      },
    }),
    prisma.financialRecord.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[1].id,
        appointmentId: appointments[1].id,
        amount: 150.0,
        type: FinancialType.INCOME,
        status: FinancialStatus.PAID,
        paymentMethod: 'Cartão de crédito',
      },
    }),
    prisma.financialRecord.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[2].id,
        appointmentId: appointments[2].id,
        amount: 200.0,
        type: FinancialType.INCOME,
        status: FinancialStatus.PENDING,
      },
    }),
    prisma.financialRecord.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[3].id,
        amount: 250.0,
        type: FinancialType.INCOME,
        status: FinancialStatus.PENDING,
        description: 'Avaliação inicial agendada',
      },
    }),
    prisma.financialRecord.create({
      data: {
        organizationId: clinicA.id,
        patientId: patients[0].id,
        amount: 50.0,
        type: FinancialType.EXPENSE,
        status: FinancialStatus.PAID,
        description: 'Material de escritório',
      },
    }),
  ]);

  console.log('Financial records created');

  // ── Anamnesis ──
  await prisma.anamnesis.create({
    data: {
      organizationId: clinicA.id,
      patientId: patients[0].id,
      professionalId: orgUserProf1.id,
      data: {
        queixaPrincipal: 'Dor no ombro direito há 3 meses',
        historico: 'Pratica musculação 3x por semana',
        medicamentos: 'Nenhum',
        alergias: 'Nenhuma conhecida',
        exames: 'Raio-X ombro sem alterações',
        objetivos: 'Retorno à prática esportiva sem dor',
      },
    },
  });

  await prisma.anamnesis.create({
    data: {
      organizationId: clinicA.id,
      patientId: patients[2].id,
      professionalId: orgUserProf2.id,
      data: {
        queixaPrincipal: 'Ansiedade e dificuldade para dormir',
        historico: 'Trabalha em ambiente de alta pressão',
        medicamentos: 'Nenhum',
        historicoFamiliar: 'Mãe com diagnóstico de depressão',
        objetivos: 'Melhorar qualidade do sono e reduzir ansiedade',
      },
    },
  });

  console.log('Anamneses created');

  // ── Evolutions ──
  await prisma.evolution.create({
    data: {
      organizationId: clinicA.id,
      patientId: patients[0].id,
      professionalId: orgUserProf1.id,
      appointmentId: appointments[0].id,
      description:
        'Paciente relata melhora de 30% na dor. Realizado mobilização articular ' +
        'glenoumeral e exercícios de fortalecimento do manguito rotador. ' +
        'Orientado a manter compressas de gelo após treinos.',
    },
  });

  await prisma.evolution.create({
    data: {
      organizationId: clinicA.id,
      patientId: patients[2].id,
      professionalId: orgUserProf2.id,
      appointmentId: appointments[2].id,
      description:
        'Sessão focada em técnicas de respiração e relaxamento. ' +
        'Paciente demonstrou boa adesão aos exercícios propostos na sessão anterior. ' +
        'Relata leve melhora no sono nos últimos dias.',
    },
  });

  console.log('Evolutions created');

  // Documentos de sistema — organizationId: null = visível para todas as clínicas
  await prisma.clinicDocument.createMany({
    data: [
      {
        organizationId: null,
        name: 'Diário Miccional',
        description: 'Registro diário das micções. Preencher durante 3 dias consecutivos.',
        category: 'Avaliação',
        type: 'FILE',
        fileKey: 'system/diario-miccional.pdf',
        mimeType: 'application/pdf',
        fileSize: 0,
        active: true,
      },
      {
        organizationId: null,
        name: 'Termo de Consentimento — Fisioterapia Pélvica',
        description: 'Termo de consentimento livre e esclarecido para tratamento fisioterapêutico pélvico.',
        category: 'Consentimento',
        type: 'FILE',
        fileKey: 'system/termo-consentimento-fisioterapia-pelvica.pdf',
        mimeType: 'application/pdf',
        fileSize: 0,
        active: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('\n✅ Seed completed successfully!');
  console.log('\nTest credentials:');
  console.log('  CPF: 11111111111 (Admin - multi-clinic)');
  console.log('  CPF: 22222222222 (Fisioterapeuta)');
  console.log('  CPF: 33333333333 (Psicólogo)');
  console.log('  CPF: 44444444444 (Recepção)');
  console.log('  Password: 123456 (all users)');
}

function setTime(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
