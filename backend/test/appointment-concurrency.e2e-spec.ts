import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookie } from './helpers/app.helper';
import { cleanTestData, E2E_PASSWORD, seedTestData, TestFixtures } from './helpers/db.helper';
import { PrismaService } from '../src/prisma/prisma.service';

// SOU-21: appointment creation runs inside a SERIALIZABLE Postgres transaction
// (see appointment.service.ts) so that a SELECT->INSERT race can never produce
// two overlapping appointments. Postgres resolves that race by aborting one of
// the concurrent transactions with a serialization failure (Prisma P2034) —
// this suite proves the app-level retry absorbs that transient abort and that,
// under real concurrent writes to the *same* slot, exactly one request wins and
// every loser gets a clean 409 (never a raw 500/P2034 leaking to the client, and
// never a duplicate row).
describe('Appointment creation under concurrency (e2e)', () => {
  let app: INestApplication;
  let fixtures: TestFixtures;
  let cookie: string;
  let procedureId: string;
  let professionalId: string;
  const createdAppointmentIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    fixtures = await seedTestData(app);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ cpf: fixtures.singlePersonCpf, password: E2E_PASSWORD });
    cookie = extractCookie(loginRes.headers['set-cookie'], 'pelvi_access_token');

    const prisma = app.get<PrismaService>(PrismaService);
    const orgUser = await prisma.organizationUser.findFirstOrThrow({
      where: { organizationId: fixtures.org1Id },
      select: { id: true },
    });
    professionalId = orgUser.id;

    const procedure = await prisma.procedure.create({
      data: {
        organizationId: fixtures.org1Id,
        name: 'E2E Concurrency Procedure',
        durationMinutes: 30,
        price: 100,
      },
    });
    procedureId = procedure.id;
  }, 30_000);

  afterAll(async () => {
    const prisma = app.get<PrismaService>(PrismaService);
    await prisma.appointment.deleteMany({ where: { id: { in: createdAppointmentIds } } });
    await prisma.procedure.delete({ where: { id: procedureId } });
    await cleanTestData(app);
    await app.close();
  }, 15_000);

  it('exactly one request wins a concurrent race for the same slot; the rest get a clean 409 (no duplicates, no 500s)', async () => {
    const startAt = '2027-03-01T14:00:00.000Z';
    const concurrentRequests = 8;

    const responses = await Promise.all(
      Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer())
          .post('/api/appointments')
          .set('Cookie', cookie)
          .send({
            patientId: fixtures.patientOrg1Id,
            professionalId,
            procedureId,
            startAt,
          }),
      ),
    );

    const statuses = responses.map((r) => r.status).sort();
    const successes = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);

    for (const res of responses) createdAppointmentIds.push(...(res.body?.id ? [res.body.id] : []));

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(concurrentRequests - 1);
    expect(statuses.filter((s) => s >= 500)).toHaveLength(0);

    const rows = await app
      .get<PrismaService>(PrismaService)
      .appointment.findMany({ where: { professionalId, startAt: new Date(startAt), deletedAt: null } });
    expect(rows).toHaveLength(1);
  }, 30_000);
});
