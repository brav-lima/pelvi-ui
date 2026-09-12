# Pelvi App — Backend Mobile Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend pieces the new `pelvi-app` mobile client needs: token-in-body auth (login/refresh), a device-token registry, and push delivery of the existing appointment reminder via Expo Push.

**Architecture:** No new services or infra. Two new endpoints inside the existing `auth` module (mobile login/select-organization) plus one small `device` module (Prisma model + CRUD + Expo push wrapper), and the existing BullMQ reminder pipeline gains a professional-aware push step. All domain endpoints (appointments, patients, ...) are untouched — they already accept `Authorization: Bearer`.

**Tech Stack:** NestJS, Prisma 7.x, BullMQ, `expo-server-sdk` (new dependency), Jest (unit) + Supertest (e2e, requires a real Postgres per `backend/.env.test`).

**Spec:** `docs/superpowers/specs/2026-09-12-pelvi-app-mobile-design.md` (in the `pelvi-app` repo — sections 4 and 5 are what this plan implements).

## Global Constraints

- Coverage threshold: 80% statements/functions/lines, 75% branches, collected only from `**/*.service.ts` (`backend/package.json` jest config) — controllers are not unit-tested in this codebase (no `*.controller.spec.ts` files exist); controller-level behavior is covered by `backend/test/*.e2e-spec.ts` instead.
- All new Prisma columns use `@map(...)` snake_case, matching every existing model.
- Errors/log messages elsewhere in the codebase are in Portuguese; keep new user-facing strings in Portuguese.
- Push failures must be fail-open (log + Sentry breadcrumb, no rethrow) — the reminder job must not fail just because a phone is unreachable, mirroring the existing Redis/cache fail-open pattern.
- Never trust a client-sent `organizationId`/`personId` — always derive from `@CurrentUser()` / `@OrgId()`.
- Run `bun run test` (unit) after every task; only run `bun run test:e2e` for tasks that touch e2e specs and only if `backend/.env.test` is configured (real DB) — note this to the user rather than silently skipping.

---

## Task 1: `DeviceToken` Prisma model

**Files:**
- Modify: `backend/prisma/schema.prisma` (add `DevicePlatform` enum + `DeviceToken` model near the `Task` section at the end of the file; add one relation line on `Person`)

**Interfaces:**
- Produces: Prisma model `DeviceToken { id, personId, expoPushToken, platform: DevicePlatform, createdAt, updatedAt }`, enum `DevicePlatform { IOS, ANDROID }`, both exported from `@prisma/client` after generation. Later tasks import `DevicePlatform` from `@prisma/client` and call `prisma.deviceToken.*`.

- [ ] **Step 1: Add the relation field on `Person`**

In `backend/prisma/schema.prisma`, find the `Person` model (currently at line 95-110):

```prisma
model Person {
  id           String   @id @default(uuid())
  cpf          String   @unique
  name         String
  email        String   @unique
  phone        String?
  passwordHash String   @map("password_hash")
  active       Boolean  @default(true)
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  organizationUsers OrganizationUser[]
  refreshTokens     RefreshToken[]

  @@map("persons")
}
```

Add `deviceTokens DeviceToken[]` right after `refreshTokens`:

```prisma
  organizationUsers OrganizationUser[]
  refreshTokens     RefreshToken[]
  deviceTokens      DeviceToken[]
```

- [ ] **Step 2: Append the new model at the end of the schema file**

Add this block at the very end of `backend/prisma/schema.prisma` (after the `Task` model):

```prisma
// ──────────────────────────────────────────────
// DeviceToken — token de push (Expo) por dispositivo mobile
// ──────────────────────────────────────────────

enum DevicePlatform {
  IOS
  ANDROID
}

model DeviceToken {
  id            String         @id @default(uuid())
  personId      String         @map("person_id")
  expoPushToken String         @unique @map("expo_push_token")
  platform      DevicePlatform
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  person Person @relation(fields: [personId], references: [id])

  @@map("device_tokens")
}
```

- [ ] **Step 3: Validate the schema**

Run: `cd backend && bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Create and apply the dev migration**

Run: `cd backend && bunx prisma migrate dev --name add_device_token`
Expected: creates `backend/prisma/migrations/<timestamp>_add_device_token/migration.sql`, applies it to your local dev DB, and regenerates the Prisma Client (so `DevicePlatform` and `prisma.deviceToken` become available on `@prisma/client`).

- [ ] **Step 5: Confirm the client compiles with the new types**

Run: `cd backend && bunx tsc --noEmit`
Expected: no errors (the new `DeviceToken`/`DevicePlatform` types exist but nothing references them yet, so this just proves the generated client is valid).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(prisma): add DeviceToken model for mobile push tokens"
```

---

## Task 2: `device` module — register/remove push tokens + Expo push wrapper

**Files:**
- Create: `backend/src/device/dto/register-device.dto.ts`
- Create: `backend/src/device/device.service.ts`
- Create: `backend/src/device/device.service.spec.ts`
- Create: `backend/src/device/expo-push.service.ts`
- Create: `backend/src/device/expo-push.service.spec.ts`
- Create: `backend/src/device/device.controller.ts`
- Create: `backend/src/device/device.module.ts`
- Modify: `backend/src/app.module.ts` (register `DeviceModule`)
- Modify: `backend/package.json` (add `expo-server-sdk` dependency)

**Interfaces:**
- Consumes: `PrismaService` (global, from `../prisma/prisma.service`), `@CurrentUser()` / `JwtPayload` (from `../auth/decorators/current-user.decorator` and `../auth/strategies/jwt.strategy`).
- Produces: `DeviceService.register(personId: string, dto: RegisterDeviceDto): Promise<DeviceToken>`, `DeviceService.remove(personId: string, expoPushToken: string): Promise<void>`, `ExpoPushService.isValidToken(token: string): boolean`, `ExpoPushService.send(messages: ExpoPushMessage[]): Promise<void>` — `ExpoPushService` is exported from `DeviceModule` for Task 6 (`ReminderProcessor`) to consume. `POST /api/v1/devices` and `DELETE /api/v1/devices/:expoPushToken` (JWT-protected).

- [ ] **Step 1: Add the `expo-server-sdk` dependency**

Run: `cd backend && bun add expo-server-sdk`
Expected: `expo-server-sdk` added to `backend/package.json` dependencies and `bun.lock` updated.

- [ ] **Step 2: Write the failing test for `DeviceService`**

Create `backend/src/device/device.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { DeviceService } from './device.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DeviceService', () => {
  let service: DeviceService;
  let prisma: { deviceToken: any };

  beforeEach(async () => {
    prisma = {
      deviceToken: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DeviceService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<DeviceService>(DeviceService);
  });

  it('registra um device token via upsert pelo expoPushToken', async () => {
    prisma.deviceToken.upsert.mockResolvedValue({ id: 'device-1' });

    await service.register('person-1', {
      expoPushToken: 'ExponentPushToken[abc]',
      platform: 'IOS' as any,
    });

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
      where: { expoPushToken: 'ExponentPushToken[abc]' },
      update: { personId: 'person-1', platform: 'IOS' },
      create: {
        personId: 'person-1',
        expoPushToken: 'ExponentPushToken[abc]',
        platform: 'IOS',
      },
    });
  });

  it('remove um device token só se pertencer à pessoa autenticada', async () => {
    prisma.deviceToken.deleteMany.mockResolvedValue({ count: 1 });

    await service.remove('person-1', 'ExponentPushToken[abc]');

    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { expoPushToken: 'ExponentPushToken[abc]', personId: 'person-1' },
    });
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd backend && bunx jest device.service.spec.ts`
Expected: FAIL — `Cannot find module './device.service'`

- [ ] **Step 4: Write `RegisterDeviceDto` and `DeviceService`**

Create `backend/src/device/dto/register-device.dto.ts`:

```ts
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { DevicePlatform } from '@prisma/client';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty({ message: 'expoPushToken é obrigatório' })
  expoPushToken: string;

  @IsEnum(DevicePlatform, { message: 'platform deve ser IOS ou ANDROID' })
  platform: DevicePlatform;
}
```

Create `backend/src/device/device.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async register(personId: string, dto: RegisterDeviceDto) {
    return this.prisma.deviceToken.upsert({
      where: { expoPushToken: dto.expoPushToken },
      update: { personId, platform: dto.platform },
      create: {
        personId,
        expoPushToken: dto.expoPushToken,
        platform: dto.platform,
      },
    });
  }

  async remove(personId: string, expoPushToken: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({
      where: { expoPushToken, personId },
    });
  }
}
```

- [ ] **Step 5: Run the test again to confirm it passes**

Run: `cd backend && bunx jest device.service.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Write the failing test for `ExpoPushService`**

Create `backend/src/device/expo-push.service.spec.ts`:

```ts
jest.mock('expo-server-sdk', () => {
  const sendPushNotificationsAsync = jest.fn().mockResolvedValue([{ status: 'ok' }]);
  const chunkPushNotifications = jest.fn((messages: unknown[]) => [messages]);
  const ExpoMock: any = jest.fn().mockImplementation(() => ({
    chunkPushNotifications,
    sendPushNotificationsAsync,
  }));
  ExpoMock.isExpoPushToken = jest.fn((token: string) => token.startsWith('ExponentPushToken'));
  return { Expo: ExpoMock };
});

import { Expo } from 'expo-server-sdk';
import { ExpoPushService } from './expo-push.service';

describe('ExpoPushService', () => {
  let service: ExpoPushService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExpoPushService();
  });

  it('valida token via Expo.isExpoPushToken', () => {
    expect(service.isValidToken('ExponentPushToken[abc]')).toBe(true);
    expect(service.isValidToken('token-invalido')).toBe(false);
  });

  it('divide mensagens em chunks e envia cada chunk', async () => {
    const messages = [{ to: 'ExponentPushToken[abc]', title: 't', body: 'b' }];

    await service.send(messages as any);

    const expoInstance = (Expo as unknown as jest.Mock).mock.results[0].value;
    expect(expoInstance.chunkPushNotifications).toHaveBeenCalledWith(messages);
    expect(expoInstance.sendPushNotificationsAsync).toHaveBeenCalledWith(messages);
  });
});
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `cd backend && bunx jest expo-push.service.spec.ts`
Expected: FAIL — `Cannot find module './expo-push.service'`

- [ ] **Step 8: Write `ExpoPushService`**

Create `backend/src/device/expo-push.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class ExpoPushService {
  private readonly expo = new Expo();

  isValidToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  async send(messages: ExpoPushMessage[]): Promise<void> {
    const chunks = this.expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await this.expo.sendPushNotificationsAsync(chunk);
    }
  }
}
```

- [ ] **Step 9: Run the test again to confirm it passes**

Run: `cd backend && bunx jest expo-push.service.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 10: Add the controller and module (no unit test — thin delegation, per this repo's convention of not unit-testing controllers)**

Create `backend/src/device/device.controller.ts`:

```ts
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

@ApiBearerAuth()
@ApiTags('Devices')
@Controller('devices')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  register(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    return this.deviceService.register(user.sub, dto);
  }

  @Delete(':expoPushToken')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('expoPushToken') expoPushToken: string) {
    return this.deviceService.remove(user.sub, expoPushToken);
  }
}
```

Create `backend/src/device/device.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DeviceController } from './device.controller';
import { DeviceService } from './device.service';
import { ExpoPushService } from './expo-push.service';

@Module({
  controllers: [DeviceController],
  providers: [DeviceService, ExpoPushService],
  exports: [ExpoPushService],
})
export class DeviceModule {}
```

In `backend/src/app.module.ts`, add the import next to `TaskModule` (both the `import` line and the entry in the `imports` array — follow the existing list, e.g. right after `import { TaskModule } from './task/task.module';` and after `TaskModule` in the array):

```ts
import { DeviceModule } from './device/device.module';
```

```ts
    TaskModule,
    DeviceModule,
```

- [ ] **Step 11: Run the full unit suite**

Run: `cd backend && bun run test`
Expected: all suites PASS, including the two new spec files.

- [ ] **Step 12: Commit**

```bash
git add backend/src/device backend/src/app.module.ts backend/package.json backend/bun.lock
git commit -m "feat(device): add device token registry + Expo push wrapper"
```

---

## Task 3: Mobile login — `POST /auth/mobile-login` + `POST /auth/mobile-select-organization`

**Files:**
- Modify: `backend/src/auth/auth.controller.ts` (add two methods)
- Modify: `backend/test/auth.e2e-spec.ts:74` (insert new `describe` blocks after the existing `select-organization` block, i.e. after line 115 `});` and before line 116's `GET /api/auth/me` block — see step 1)

**Interfaces:**
- Consumes: `AuthService.login(dto: LoginDto)` and `AuthService.selectOrganization(dto: SelectOrganizationDto)` — unchanged, already used by `/login` and `/select-organization`.
- Produces: `POST /api/auth/mobile-login`, `POST /api/auth/mobile-select-organization` — same request/response shape as their web counterparts, except tokens are always left in the JSON body and no cookies are set.

- [ ] **Step 1: Write the failing e2e tests**

In `backend/test/auth.e2e-spec.ts`, insert this new block right after the `describe('POST /api/auth/select-organization', ...)` block closes (after line 115, before the `// ── GET /api/auth/me` comment / `describe('GET /api/auth/me'...)` at line 116):

```ts
  // ── POST /api/auth/mobile-login ────────────────────────────────────────────────

  describe('POST /api/auth/mobile-login', () => {
    it('returns tokens in the body without setting cookies for a single-clinic user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/mobile-login')
        .send({ cpf: fixtures.singlePersonCpf, password: E2E_PASSWORD })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(normalizeCookies(res.headers['set-cookie'])).toHaveLength(0);
    });

    it('returns preAuthToken + org list for a multi-clinic user, no tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/mobile-login')
        .send({ cpf: fixtures.multiPersonCpf, password: E2E_PASSWORD })
        .expect(200);

      expect(res.body.preAuthToken).toBeDefined();
      expect(res.body.accessToken).toBeUndefined();
      expect(normalizeCookies(res.headers['set-cookie'])).toHaveLength(0);
    });
  });

  // ── POST /api/auth/mobile-select-organization ────────────────────────────────

  describe('POST /api/auth/mobile-select-organization', () => {
    it('returns tokens in the body after selecting an organization', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/mobile-login')
        .send({ cpf: fixtures.multiPersonCpf, password: E2E_PASSWORD })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/auth/mobile-select-organization')
        .send({ preAuthToken: login.body.preAuthToken, organizationId: fixtures.org1Id })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(normalizeCookies(res.headers['set-cookie'])).toHaveLength(0);
    });
  });

```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && bun run test:e2e -- auth.e2e-spec.ts` (requires `backend/.env.test` pointing at a real Postgres — see `backend/.env.test.example`; if you don't have one set up, ask the user before proceeding rather than skipping verification silently)
Expected: FAIL — `404 Not Found` for `/api/auth/mobile-login`.

- [ ] **Step 3: Add the two controller methods**

In `backend/src/auth/auth.controller.ts`, add these two methods right after `selectOrganization` (after line 127, before `switchOrganization`):

```ts
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @Post('mobile-login')
  @ApiOperation({
    summary: 'Login mobile via CPF + senha',
    description:
      'Equivalente a /login, mas para o app mobile: os tokens sempre viajam no corpo da ' +
      'resposta (nunca em cookie). Se o CPF está vinculado a N clínicas, retorna a lista ' +
      'de organizações e o app deve chamar /mobile-select-organization.',
  })
  @ApiResponse({ status: 200, description: 'Login realizado com sucesso' })
  @ApiResponse({ status: 401, description: 'CPF ou senha inválidos / nenhuma clínica vinculada' })
  async mobileLogin(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('mobile-select-organization')
  @ApiOperation({
    summary: 'Selecionar organização após login multi-clínica (mobile)',
    description: 'Equivalente a /select-organization, mas retorna os tokens no corpo da resposta.',
  })
  @ApiResponse({ status: 200, description: 'Sessão iniciada com sucesso' })
  @ApiResponse({ status: 401, description: 'Vínculo inválido ou inativo' })
  async mobileSelectOrganization(@Body() dto: SelectOrganizationDto) {
    return this.authService.selectOrganization(dto);
  }

```

- [ ] **Step 4: Run the e2e tests again to confirm they pass**

Run: `cd backend && bun run test:e2e -- auth.e2e-spec.ts`
Expected: PASS (all tests in the file, including the 3 new ones)

- [ ] **Step 5: Run the full unit suite too (regression check)**

Run: `cd backend && bun run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/auth.controller.ts backend/test/auth.e2e-spec.ts
git commit -m "feat(auth): add mobile-login and mobile-select-organization endpoints"
```

---

## Task 4: Mobile refresh — accept refresh token in body, return tokens in body

**Files:**
- Modify: `backend/src/auth/strategies/jwt-refresh.strategy.ts:21-23`
- Modify: `backend/src/auth/auth.controller.ts:171-182`
- Modify: `backend/test/auth.e2e-spec.ts` (insert new test inside/after the existing `describe('POST /api/auth/refresh', ...)` block, currently at lines 216-258)

**Interfaces:**
- Consumes: `AuthService.rotateRefreshToken(personId, organizationId, jti): Promise<IssuedTokens>` — unchanged.
- Produces: `POST /api/auth/refresh` now also accepts `{ refreshToken: string }` in the JSON body (in addition to the existing `pelvi_refresh_token` cookie) and, when authenticated that way, returns `{ accessToken, refreshToken }` in the body instead of `{ ok: true }` + cookies.

- [ ] **Step 1: Write the failing e2e test**

In `backend/test/auth.e2e-spec.ts`, add this test inside the existing `describe('POST /api/auth/refresh', ...)` block (after the `'rejects reuse of a refresh token that was already rotated'` test, i.e. after line 257, still before the block's closing `});` on line 258):

```ts

    it('accepts a refreshToken in the body and returns new tokens in the body (mobile)', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/auth/mobile-login')
        .send({ cpf: fixtures.singlePersonCpf, password: E2E_PASSWORD })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.refreshToken).not.toBe(login.body.refreshToken);
      expect(normalizeCookies(res.headers['set-cookie'])).toHaveLength(0);
    });
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && bun run test:e2e -- auth.e2e-spec.ts`
Expected: FAIL — `401 Unauthorized` (the refresh strategy doesn't read the body yet).

- [ ] **Step 3: Extend the refresh token extractor**

In `backend/src/auth/strategies/jwt-refresh.strategy.ts`, change the `jwtFromRequest` extractors (lines 21-23):

```ts
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.[REFRESH_COOKIE_NAME] as string | undefined) ?? null,
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
```

- [ ] **Step 4: Make the controller return tokens in the body for the mobile (body-token) path**

In `backend/src/auth/auth.controller.ts`, replace the `refresh` method (lines 171-182):

```ts
  async refresh(
    @CurrentRefreshUser() refreshUser: RefreshUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.rotateRefreshToken(
      refreshUser.personId,
      refreshUser.organizationId,
      refreshUser.jti,
    );

    const isMobile = Boolean((req.body as { refreshToken?: string } | undefined)?.refreshToken);
    if (isMobile) {
      return tokens;
    }

    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ok: true };
  }
```

- [ ] **Step 5: Run the e2e tests again to confirm they pass**

Run: `cd backend && bun run test:e2e -- auth.e2e-spec.ts`
Expected: PASS (all tests, including the new one). The two pre-existing refresh tests (cookie-based) must still pass unchanged — they never send a body, so `isMobile` stays `false` for them.

- [ ] **Step 6: Run the full unit suite (regression check)**

Run: `cd backend && bun run test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/strategies/jwt-refresh.strategy.ts backend/src/auth/auth.controller.ts backend/test/auth.e2e-spec.ts
git commit -m "feat(auth): accept refresh token in body and return tokens in body for mobile"
```

---

## Task 5: `professionalId` in the reminder job payload

**Files:**
- Modify: `backend/src/queue/jobs/reminder.job.ts`
- Modify: `backend/src/appointment/appointment.service.ts:515-550` (method signatures) and call sites at lines 128, 257, 414, 488
- Modify: `backend/src/appointment/appointment.service.spec.ts` (add one test)

**Interfaces:**
- Produces: `ReminderJobData` now includes `professionalId: string` — Task 6's `ReminderProcessor` relies on this field being present on every job.

- [ ] **Step 1: Write the failing test**

In `backend/src/appointment/appointment.service.spec.ts`, add this test inside the `describe('create', ...)` block, right after the existing `'deve capturar no Sentry e propagar erro quando enfileirar o lembrete falha'` test (after line 226):

```ts

    it('inclui professionalId no payload do job de lembrete', async () => {
      prisma.procedure.findFirst.mockResolvedValue(mockProcedure);
      prisma.appointment.findFirst.mockResolvedValue(null);
      prisma.appointment.create.mockResolvedValue({ id: 'apt-1', professionalId: 'prof-1' });

      const futureStart = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();

      await service.create(orgId, {
        patientId: 'patient-1',
        professionalId: 'prof-1',
        procedureId: 'proc-1',
        startAt: futureStart,
      });

      expect(reminderQueue.add).toHaveBeenCalledWith(
        'reminder',
        expect.objectContaining({ professionalId: 'prof-1' }),
        expect.any(Object),
      );
    });
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && bunx jest appointment.service.spec.ts -t "inclui professionalId"`
Expected: FAIL — received job payload has no `professionalId` key.

- [ ] **Step 3: Add `professionalId` to `ReminderJobData`**

In `backend/src/queue/jobs/reminder.job.ts`, update the interface:

```ts
export const REMINDER_QUEUE = 'reminders';

export interface ReminderJobData {
  appointmentId: string;
  patientId: string;
  professionalId: string;
  organizationId: string;
  startAt: string;
}
```

- [ ] **Step 4: Thread `professionalId` through `scheduleReminder`/`rescheduleReminder`**

In `backend/src/appointment/appointment.service.ts`, replace the two private methods (lines 515-550):

```ts
  private async scheduleReminder(
    appointmentId: string,
    patientId: string,
    professionalId: string,
    organizationId: string,
    startAt: Date,
  ): Promise<void> {
    const delay = startAt.getTime() - Date.now() - 60 * 60 * 1000; // 1h antes
    if (delay <= 0) return;

    try {
      await this.reminderQueue.add(
        'reminder',
        { appointmentId, patientId, professionalId, organizationId, startAt: startAt.toISOString() },
        { jobId: `reminder-${appointmentId}`, delay },
      );
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'queue',
        message: 'reminder scheduling failed',
        level: 'error',
        data: { appointmentId },
      });
      Sentry.captureException(err);
      throw err;
    }
  }

  private async rescheduleReminder(
    appointmentId: string,
    patientId: string,
    professionalId: string,
    organizationId: string,
    startAt: Date,
  ): Promise<void> {
    await this.cancelReminder(appointmentId);
    await this.scheduleReminder(appointmentId, patientId, professionalId, organizationId, startAt);
  }
```

- [ ] **Step 5: Update the four call sites**

In `backend/src/appointment/appointment.service.ts`:

Line 128 (inside `create`):
```ts
      await this.scheduleReminder(created.id, dto.patientId, created.professionalId, organizationId, startAt);
```

Line 257 (inside `update` — note the local `professionalId` variable defined at line 236 already resolves `dto.professionalId ?? existing.professionalId`, so a professional change is reflected in the reminder too):
```ts
        await this.rescheduleReminder(id, existing.patientId, professionalId, organizationId, startAt);
```

Line 414 (inside the recurrence-creation loop):
```ts
      await this.scheduleReminder(apt.id, apt.patientId, apt.professionalId, organizationId, startAt);
```

Line 488 (inside `updateRecurrenceForward`):
```ts
        await this.rescheduleReminder(apt.id, apt.patientId, apt.professionalId, organizationId, apt.startAt);
```

- [ ] **Step 6: Run the test again to confirm it passes**

Run: `cd backend && bunx jest appointment.service.spec.ts`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 7: Commit**

```bash
git add backend/src/queue/jobs/reminder.job.ts backend/src/appointment/appointment.service.ts backend/src/appointment/appointment.service.spec.ts
git commit -m "feat(appointment): include professionalId in the reminder job payload"
```

---

## Task 6: `ReminderProcessor` — dispatch push via Expo

**Files:**
- Modify: `backend/src/queue/processors/reminder.processor.ts`
- Modify: `backend/src/queue/processors/reminder.processor.spec.ts`
- Modify: `backend/src/queue/queue.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (`prisma.organizationUser.findUnique`, `prisma.deviceToken.findMany`, `prisma.patient.findUnique`), `ExpoPushService.isValidToken` / `ExpoPushService.send` (Task 2, exported from `DeviceModule`).

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `backend/src/queue/processors/reminder.processor.spec.ts`:

```ts
import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { ReminderProcessor } from './reminder.processor';
import { ReminderJobData } from '../jobs/reminder.job';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpoPushService } from '../../device/expo-push.service';

jest.mock('@sentry/nestjs', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

describe('ReminderProcessor', () => {
  let processor: ReminderProcessor;
  let prisma: { organizationUser: any; deviceToken: any; patient: any };
  let pushService: { isValidToken: jest.Mock; send: jest.Mock };

  const baseData: ReminderJobData = {
    appointmentId: 'apt-1',
    patientId: 'patient-1',
    professionalId: 'prof-1',
    organizationId: 'org-1',
    startAt: '2026-08-01T13:00:00.000Z',
  };

  const makeJob = (data: ReminderJobData): Job<ReminderJobData> => ({ data }) as Job<ReminderJobData>;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      organizationUser: { findUnique: jest.fn().mockResolvedValue({ personId: 'person-1' }) },
      deviceToken: { findMany: jest.fn().mockResolvedValue([]) },
      patient: { findUnique: jest.fn().mockResolvedValue({ name: 'Maria' }) },
    };
    pushService = {
      isValidToken: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue(undefined),
    };

    processor = new ReminderProcessor(prisma as unknown as PrismaService, pushService as unknown as ExpoPushService);
  });

  it('processa o lembrete sem erro quando não há device token cadastrado', async () => {
    await processor.process(makeJob(baseData));

    expect(pushService.send).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('envia push pros device tokens do profissional quando existem', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([
      { expoPushToken: 'ExponentPushToken[abc]' },
      { expoPushToken: 'ExponentPushToken[def]' },
    ]);

    await processor.process(makeJob(baseData));

    expect(prisma.organizationUser.findUnique).toHaveBeenCalledWith({
      where: { id: 'prof-1' },
      select: { personId: true },
    });
    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({ where: { personId: 'person-1' } });
    expect(pushService.send).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[abc]', body: expect.stringContaining('Maria') }),
      expect.objectContaining({ to: 'ExponentPushToken[def]', body: expect.stringContaining('Maria') }),
    ]);
  });

  it('não envia push e não relança quando o envio falha (best-effort)', async () => {
    prisma.deviceToken.findMany.mockResolvedValue([{ expoPushToken: 'ExponentPushToken[abc]' }]);
    pushService.send.mockRejectedValue(new Error('expo down'));

    await expect(processor.process(makeJob(baseData))).resolves.toBeUndefined();

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it('captura exceção no Sentry e relança quando o processamento falha por outro motivo', async () => {
    const job = makeJob(baseData);

    const originalLog = (processor as any).logger.log;
    (processor as any).logger.log = jest.fn(() => {
      throw new Error('boom');
    });

    await expect(processor.process(job)).rejects.toThrow('boom');

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: 'queue',
      message: 'reminder processing failed',
      level: 'error',
      data: { appointmentId: 'apt-1' },
    });

    (processor as any).logger.log = originalLog;
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd backend && bunx jest reminder.processor.spec.ts`
Expected: FAIL — `ReminderProcessor` constructor doesn't accept arguments yet, and the push-related assertions have nothing to match.

- [ ] **Step 3: Implement the push dispatch**

Replace the full contents of `backend/src/queue/processors/reminder.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Job } from 'bullmq';
import { REMINDER_QUEUE, ReminderJobData } from '../jobs/reminder.job';
import { PrismaService } from '../../prisma/prisma.service';
import { ExpoPushService } from '../../device/expo-push.service';

@Processor(REMINDER_QUEUE)
export class ReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(ReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: ExpoPushService,
  ) {
    super();
  }

  async process(job: Job<ReminderJobData>): Promise<void> {
    const { appointmentId, patientId, organizationId, professionalId, startAt } = job.data;

    try {
      this.logger.log(
        `Reminder: appointment=${appointmentId} patient=${patientId} org=${organizationId} startAt=${startAt}`,
      );

      await this.sendPushReminder(professionalId, patientId, startAt);

      // TODO: adicionar outros canais quando disponíveis:
      // - WhatsApp
      // - Email
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'queue',
        message: 'reminder processing failed',
        level: 'error',
        data: { appointmentId },
      });
      Sentry.captureException(err);
      throw err;
    }
  }

  private async sendPushReminder(
    professionalId: string,
    patientId: string,
    startAt: string,
  ): Promise<void> {
    const orgUser = await this.prisma.organizationUser.findUnique({
      where: { id: professionalId },
      select: { personId: true },
    });
    if (!orgUser) return;

    const devices = await this.prisma.deviceToken.findMany({
      where: { personId: orgUser.personId },
    });
    const validDevices = devices.filter((d) => this.pushService.isValidToken(d.expoPushToken));
    if (validDevices.length === 0) return;

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true },
    });

    const time = new Date(startAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    const body = patient ? `${time} com ${patient.name}` : `Consulta às ${time}`;

    try {
      await this.pushService.send(
        validDevices.map((d) => ({
          to: d.expoPushToken,
          sound: 'default' as const,
          title: 'Consulta em 1 hora',
          body,
        })),
      );
    } catch (err) {
      Sentry.addBreadcrumb({
        category: 'queue',
        message: 'push reminder send failed',
        level: 'warning',
      });
      Sentry.captureException(err);
      // best-effort: não relança — falha de push não deve reprocessar o job
    }
  }
}
```

- [ ] **Step 4: Wire `ExpoPushService` into `QueueModule`**

In `backend/src/queue/queue.module.ts`, add the import and register `DeviceModule`:

```ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { REMINDER_QUEUE } from './jobs/reminder.job';
import { TOKEN_CLEANUP_QUEUE } from './jobs/token-cleanup.job';
import { ReminderProcessor } from './processors/reminder.processor';
import { TokenCleanupProcessor } from './processors/token-cleanup.processor';
import { SchedulerService } from './scheduler.service';
import { DeviceModule } from '../device/device.module';

const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
          maxRetriesPerRequest: null,
        },
      }),
    }),
    BullModule.registerQueue({ name: REMINDER_QUEUE }),
    BullModule.registerQueue({ name: TOKEN_CLEANUP_QUEUE }),
    DeviceModule,
  ],
  providers: isTest ? [] : [ReminderProcessor, TokenCleanupProcessor, SchedulerService],
  exports: [BullModule],
})
export class QueueModule {}
```

- [ ] **Step 5: Run the test again to confirm it passes**

Run: `cd backend && bunx jest reminder.processor.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the full unit suite (regression + coverage check)**

Run: `cd backend && bun run test:cov`
Expected: PASS, coverage thresholds (80% stmt/fn/lines, 75% branches) still met — `expo-push.service.ts` and `device.service.ts` are both covered by Task 2's specs.

- [ ] **Step 7: Commit**

```bash
git add backend/src/queue/processors/reminder.processor.ts backend/src/queue/processors/reminder.processor.spec.ts backend/src/queue/queue.module.ts
git commit -m "feat(queue): send push notification via Expo in the appointment reminder"
```

---

## Manual verification (after all tasks)

- [ ] Run `bun run seed` (if not already seeded) and start the backend (`bun run start:dev`).
- [ ] `curl -s -X POST http://localhost:3000/api/v1/auth/mobile-login -H 'Content-Type: application/json' -d '{"cpf":"22222222222","password":"123456"}'` — confirm the JSON response includes `accessToken` and `refreshToken`, and that no `Set-Cookie` header is present.
- [ ] `curl -s -X POST http://localhost:3000/api/v1/auth/refresh -H 'Content-Type: application/json' -d '{"refreshToken":"<token from above>"}'` — confirm it returns new `accessToken`/`refreshToken` in the body.
- [ ] `curl -s -X POST http://localhost:3000/api/v1/devices -H "Authorization: Bearer <accessToken>" -H 'Content-Type: application/json' -d '{"expoPushToken":"ExponentPushToken[test]","platform":"ANDROID"}'` — confirm 200 with the created row.
- [ ] Create an appointment starting ~65 minutes from now for that professional, wait for the BullMQ delay (or reduce it locally for a manual smoke test), and confirm the worker log shows the reminder running without a Sentry exception (the Expo API call itself will fail for a fake token — that's expected and must not crash the job, per Task 6's fail-open test).
