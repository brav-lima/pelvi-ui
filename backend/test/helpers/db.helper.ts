import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../src/prisma/prisma.service';

export const E2E_PASSWORD = 'e2e-test-password-123';

// Use CPFs that are clearly reserved for e2e — won't collide with seed data or production
const E2E_CPF_SINGLE = '00000000091'; // linked to org1 only
const E2E_CPF_MULTI = '00000000092';  // linked to org1 AND org2

const E2E_ORG_DOCS = ['00e2etestorg1', '00e2etestorg2'] as const;

export interface TestFixtures {
  org1Id: string;
  org2Id: string;
  singlePersonCpf: string;
  multiPersonCpf: string;
  patientOrg1Id: string;
  patientOrg2Id: string;
}

export async function seedTestData(app: INestApplication): Promise<TestFixtures> {
  const prisma = app.get<PrismaService>(PrismaService);
  await cleanTestData(app);

  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);

  const [org1, org2] = await Promise.all([
    prisma.organization.create({ data: { name: 'E2E Test Clinic 1', document: E2E_ORG_DOCS[0] } }),
    prisma.organization.create({ data: { name: 'E2E Test Clinic 2', document: E2E_ORG_DOCS[1] } }),
  ]);

  const [singlePerson, multiPerson] = await Promise.all([
    prisma.person.create({
      data: { cpf: E2E_CPF_SINGLE, name: 'E2E Single User', email: 'e2e-single@pelvi-e2e.test', passwordHash },
    }),
    prisma.person.create({
      data: { cpf: E2E_CPF_MULTI, name: 'E2E Multi User', email: 'e2e-multi@pelvi-e2e.test', passwordHash },
    }),
  ]);

  await prisma.organizationUser.createMany({
    data: [
      { organizationId: org1.id, personId: singlePerson.id, role: 'ADMIN' },
      { organizationId: org1.id, personId: multiPerson.id, role: 'ADMIN' },
      { organizationId: org2.id, personId: multiPerson.id, role: 'ADMIN' },
    ],
  });

  const [patient1, patient2] = await Promise.all([
    prisma.patient.create({ data: { organizationId: org1.id, name: 'E2E Patient Org1' } }),
    prisma.patient.create({ data: { organizationId: org2.id, name: 'E2E Patient Org2' } }),
  ]);

  return {
    org1Id: org1.id,
    org2Id: org2.id,
    singlePersonCpf: E2E_CPF_SINGLE,
    multiPersonCpf: E2E_CPF_MULTI,
    patientOrg1Id: patient1.id,
    patientOrg2Id: patient2.id,
  };
}

export async function cleanTestData(app: INestApplication): Promise<void> {
  const prisma = app.get<PrismaService>(PrismaService);

  const testOrgs = await prisma.organization.findMany({
    where: { document: { in: [...E2E_ORG_DOCS] } },
    select: { id: true },
  });
  const orgIds = testOrgs.map((o) => o.id);

  if (orgIds.length > 0) {
    await prisma.patient.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organizationUser.deleteMany({ where: { organizationId: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }

  // Persons first, RefreshTokens cascade via onDelete: Cascade
  await prisma.person.deleteMany({ where: { cpf: { in: [E2E_CPF_SINGLE, E2E_CPF_MULTI] } } });
}
