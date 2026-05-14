import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookie } from './helpers/app.helper';
import { cleanTestData, E2E_PASSWORD, seedTestData, TestFixtures } from './helpers/db.helper';

describe('Tenant Isolation (e2e)', () => {
  let app: INestApplication;
  let fixtures: TestFixtures;
  let org1Cookie: string;
  let org2Cookie: string;

  beforeAll(async () => {
    app = await createTestApp();
    fixtures = await seedTestData(app);

    async function loginToOrg(orgId: string): Promise<string> {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.multiPersonCpf, password: E2E_PASSWORD });

      const preAuthToken = loginRes.body.preAuthToken as string;

      const selRes = await request(app.getHttpServer())
        .post('/api/auth/select-organization')
        .send({ preAuthToken, organizationId: orgId });

      return extractCookie(selRes.headers['set-cookie'], 'pelvi_access_token');
    }

    org1Cookie = await loginToOrg(fixtures.org1Id);
    org2Cookie = await loginToOrg(fixtures.org2Id);
  }, 30_000);

  afterAll(async () => {
    await cleanTestData(app);
    await app.close();
  }, 15_000);

  // ── Patient listing ───────────────────────────────────────────────────────────

  it('org1 token only returns org1 patients', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/patients')
      .set('Cookie', org1Cookie)
      .expect(200);

    const ids = res.body.data.map((p: { id: string }) => p.id);
    expect(ids).toContain(fixtures.patientOrg1Id);
    expect(ids).not.toContain(fixtures.patientOrg2Id);
  });

  it('org2 token only returns org2 patients', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/patients')
      .set('Cookie', org2Cookie)
      .expect(200);

    const ids = res.body.data.map((p: { id: string }) => p.id);
    expect(ids).toContain(fixtures.patientOrg2Id);
    expect(ids).not.toContain(fixtures.patientOrg1Id);
  });

  // ── Patient detail (cross-org access) ────────────────────────────────────────

  it('org1 token gets 404 when fetching an org2 patient by id', async () => {
    await request(app.getHttpServer())
      .get(`/api/patients/${fixtures.patientOrg2Id}`)
      .set('Cookie', org1Cookie)
      .expect(404);
  });

  it('org2 token gets 404 when fetching an org1 patient by id', async () => {
    await request(app.getHttpServer())
      .get(`/api/patients/${fixtures.patientOrg1Id}`)
      .set('Cookie', org2Cookie)
      .expect(404);
  });

  // ── Unauthenticated access ────────────────────────────────────────────────────

  it('returns 401 when no auth cookie is provided', async () => {
    await request(app.getHttpServer()).get('/api/patients').expect(401);
  });
});
