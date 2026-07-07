import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, extractCookie, normalizeCookies } from './helpers/app.helper';
import { cleanTestData, E2E_PASSWORD, seedTestData, TestFixtures } from './helpers/db.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    app = await createTestApp();
    fixtures = await seedTestData(app);
  }, 30_000);

  afterAll(async () => {
    await cleanTestData(app);
    await app.close();
  }, 15_000);

  // ── POST /api/auth/login ──────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.singlePersonCpf, password: 'wrong-password' })
        .expect(401);
    });

    it('returns 401 for unknown CPF', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: '00000000099', password: E2E_PASSWORD })
        .expect(401);
    });

    it('returns 400 for malformed CPF', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: 'abc', password: E2E_PASSWORD })
        .expect(400);
    });

    it('sets auth cookies and returns person + organization for single-clinic user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.singlePersonCpf, password: E2E_PASSWORD })
        .expect(200);

      const cookies = normalizeCookies(res.headers['set-cookie']);
      expect(cookies.some((c) => c.startsWith('pelvi_access_token='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('pelvi_refresh_token='))).toBe(true);
      expect(res.body.person).toBeDefined();
      expect(res.body.organization).toBeDefined();
      expect(res.body.organization.id).toBe(fixtures.org1Id);
      expect(res.body.accessToken).toBeUndefined(); // stripped before sending
      expect(res.body.refreshToken).toBeUndefined();
    });

    it('returns preAuthToken + org list for multi-clinic user (no cookies)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.multiPersonCpf, password: E2E_PASSWORD })
        .expect(200);

      expect(res.body.preAuthToken).toBeDefined();
      expect(res.body.organizations).toHaveLength(2);
      expect(normalizeCookies(res.headers['set-cookie'])).toHaveLength(0);
    });
  });

  // ── POST /api/auth/select-organization ───────────────────────────────────────

  describe('POST /api/auth/select-organization', () => {
    async function getPreAuthToken(): Promise<string> {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.multiPersonCpf, password: E2E_PASSWORD })
        .expect(200);
      return res.body.preAuthToken as string;
    }

    it('sets auth cookies after selecting a valid organization', async () => {
      const preAuthToken = await getPreAuthToken();

      const res = await request(app.getHttpServer())
        .post('/api/auth/select-organization')
        .send({ preAuthToken, organizationId: fixtures.org1Id })
        .expect(200);

      const cookies = normalizeCookies(res.headers['set-cookie']);
      expect(cookies.some((c) => c.startsWith('pelvi_access_token='))).toBe(true);
      expect(res.body.person).toBeDefined();
      expect(res.body.organization.id).toBe(fixtures.org1Id);
    });

    it('returns 401 for an invalid preAuthToken', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/select-organization')
        .send({ preAuthToken: 'invalid-token', organizationId: fixtures.org1Id })
        .expect(401);
    });

    it('returns 401 when selecting a non-existent organization', async () => {
      const preAuthToken = await getPreAuthToken();

      await request(app.getHttpServer())
        .post('/api/auth/select-organization')
        .send({ preAuthToken, organizationId: '00000000-0000-4000-8000-000000000000' })
        .expect(401);
    });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('returns 401 without auth cookie', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('returns profile for authenticated single-clinic user', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.singlePersonCpf, password: E2E_PASSWORD });

      const cookie = extractCookie(loginRes.headers['set-cookie'], 'pelvi_access_token');

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(res.body.person.cpf).toBe(fixtures.singlePersonCpf);
      expect(res.body.organization.id).toBe(fixtures.org1Id);
      expect(res.body.role).toBe('ADMIN');
    });
  });

  // ── POST /api/auth/switch-organization ────────────────────────────────────────

  describe('POST /api/auth/switch-organization', () => {
    it('returns 401 without auth cookie', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/switch-organization')
        .send({ organizationId: '00000000-0000-4000-8000-000000000000' })
        .expect(401);
    });

    it('switches to another linked organization and re-issues cookies', async () => {
      // Establish a session for the multi-org user, scoped to org1
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.multiPersonCpf, password: E2E_PASSWORD });
      const preAuthToken = loginRes.body.preAuthToken as string;

      const selectRes = await request(app.getHttpServer())
        .post('/api/auth/select-organization')
        .send({ preAuthToken, organizationId: fixtures.org1Id });
      const accessCookie = extractCookie(selectRes.headers['set-cookie'], 'pelvi_access_token');

      const res = await request(app.getHttpServer())
        .post('/api/auth/switch-organization')
        .set('Cookie', accessCookie)
        .send({ organizationId: fixtures.org2Id })
        .expect(200);

      expect(res.body.organization.id).toBe(fixtures.org2Id);
      expect(res.body.organizations).toHaveLength(2);
      const newCookies = normalizeCookies(res.headers['set-cookie']);
      expect(newCookies.some((c) => c.startsWith('pelvi_access_token='))).toBe(true);
      expect(newCookies.some((c) => c.startsWith('pelvi_refresh_token='))).toBe(true);
    });

    it('returns 401 when switching to an organization the user is not linked to', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.singlePersonCpf, password: E2E_PASSWORD });
      const accessCookie = extractCookie(loginRes.headers['set-cookie'], 'pelvi_access_token');

      await request(app.getHttpServer())
        .post('/api/auth/switch-organization')
        .set('Cookie', accessCookie)
        .send({ organizationId: fixtures.org2Id })
        .expect(401);
    });

    it('revokes the pre-switch refresh token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.multiPersonCpf, password: E2E_PASSWORD });
      const preAuthToken = loginRes.body.preAuthToken as string;

      const selectRes = await request(app.getHttpServer())
        .post('/api/auth/select-organization')
        .send({ preAuthToken, organizationId: fixtures.org1Id });
      const oldRefreshCookie = extractCookie(selectRes.headers['set-cookie'], 'pelvi_refresh_token');
      const accessCookie = extractCookie(selectRes.headers['set-cookie'], 'pelvi_access_token');

      // A real browser sends both cookies here — the refresh cookie's path
      // (/api/v1/auth) covers this route, so it travels alongside the access cookie.
      await request(app.getHttpServer())
        .post('/api/auth/switch-organization')
        .set('Cookie', `${accessCookie}; ${oldRefreshCookie}`)
        .send({ organizationId: fixtures.org2Id })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', oldRefreshCookie)
        .expect(401);
    });
  });

  // ── POST /api/auth/refresh ────────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('returns 401 without refresh cookie', async () => {
      await request(app.getHttpServer()).post('/api/auth/refresh').expect(401);
    });

    it('rotates tokens and issues new cookies', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.singlePersonCpf, password: E2E_PASSWORD });

      const refreshCookie = extractCookie(loginRes.headers['set-cookie'], 'pelvi_refresh_token');

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200);

      expect(res.body.ok).toBe(true);
      const newCookies = normalizeCookies(res.headers['set-cookie']);
      expect(newCookies.some((c) => c.startsWith('pelvi_access_token='))).toBe(true);
      expect(newCookies.some((c) => c.startsWith('pelvi_refresh_token='))).toBe(true);
    });

    it('rejects reuse of a refresh token that was already rotated', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.singlePersonCpf, password: E2E_PASSWORD });

      const refreshCookie = extractCookie(loginRes.headers['set-cookie'], 'pelvi_refresh_token');

      // First rotation — succeeds
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200);

      // Second rotation with same token — must fail (token reuse)
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(401);
    });
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('returns ok and clears cookies', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ cpf: fixtures.singlePersonCpf, password: E2E_PASSWORD });

      const accessCookie = extractCookie(loginRes.headers['set-cookie'], 'pelvi_access_token');

      const res = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', accessCookie)
        .expect(200);

      expect(res.body.ok).toBe(true);
      const clearedAccess = normalizeCookies(res.headers['set-cookie']).find((c) =>
        c.includes('pelvi_access_token'),
      );
      expect(clearedAccess).toContain('Max-Age=0');
    });

    it('GET /api/auth/me returns 401 when no cookie is sent after logout', async () => {
      // After logout the client no longer has a valid cookie — sending no cookie returns 401
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });
  });
});
