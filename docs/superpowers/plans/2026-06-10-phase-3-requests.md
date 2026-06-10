# FlowGate Phase 3: Requests (CRUD + Wizard) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **STATUS: BESTÄTIGT (10.06.2026)** — Wizard-Felder ok; Entscheidung: diesmal OHNE Lern-Stelle (Pascal liest Wizard-Code im Anschluss gemeinsam durch); Durchbau am Stück.

**Goal:** Requester können Anträge anlegen (3-Schritt-Wizard, Reactive Forms), bearbeiten (nur eigene Drafts), einreichen (Draft → Submitted) und in einer Liste/Detailansicht sehen — rollenbasiert gefiltert, REST unter `/api/v1/requests`.

**Architecture:** Neuer Bounded Context `requests` exakt nach dem `users`-Vorbild (domain framework-frei / infrastructure TypeORM / application Use-Cases + Controller). Einfache Übergangsregel „nur Draft → Submitted" lebt als Invariante in der Domain-Entity — die volle Status-Maschine kommt in Phase 4 obendrauf. Frontend: RequestsService (Signals), Liste, Wizard (3 Schritte), Detail.

**Tech Stack:** wie gehabt — NestJS/TypeORM/class-validator · Angular Reactive Forms/Signals.

**Decisions (im Durchgang bestätigen):**
1. **Wizard-Felder** (generischer interner Antrag): Schritt 1 Titel + Kategorie (`purchase` | `travel` | `access` | `other`) · Schritt 2 Beschreibung + Betrag (€, optional) + Wunschtermin (optional) · Schritt 3 Zusammenfassung + Absenden. Fachfelder liegen im `payload jsonb`.
2. **Controller-Konvention:** Controller gehören in `application/` (Use-Case-Eingänge). `auth.controller.ts` wird dorthin verschoben (Task 0).
3. **Lern-Stelle (Pascal, ~15 min):** Wizard-Schrittwechsel — `nextStep()` darf erst weiterschalten, wenn der aktuelle Schritt valide ist (Task 6).
4. **Edit-Regel Phase 3:** bearbeiten/einreichen nur **eigene** Anträge im Status `draft`. Reviewer/Admin sehen alles, ändern aber noch nichts (kommt Phase 4).

---

### Task 0: Controller-Konvention vereinheitlichen

**Files:** Move: `backend/src/auth/auth.controller.ts` → `backend/src/auth/application/auth.controller.ts` (Import-Pfade in `auth.module.ts` anpassen, Pfade im Controller von `../shared/...` auf `../../shared/...`)

- [ ] Verschieben, Imports fixen, `npx tsc --noEmit && npm run lint && npm run test:e2e` → grün, Commit `refactor(auth): move controller into application layer`.

### Task 1: `requests` Domain-Layer (framework-frei)

**Files:**
- Create: `backend/src/requests/domain/value-objects/request-status.ts`
- Create: `backend/src/requests/domain/entities/request.ts`
- Create: `backend/src/requests/domain/errors.ts`
- Create: `backend/src/requests/domain/repositories/request.repository.ts`

- [ ] **`request-status.ts`** (alle Stati schon definiert — benutzt werden in Phase 3 nur draft/submitted):

```ts
export enum RequestStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  InReview = 'in_review',
  Approved = 'approved',
  Rejected = 'rejected',
  ChangesRequested = 'changes_requested',
}
```

- [ ] **`errors.ts`** — Domain-Fehler ohne HTTP-Wissen:

```ts
export class DomainRuleViolation extends Error {}
export class NotRequestOwner extends DomainRuleViolation {}
export class RequestNotEditable extends DomainRuleViolation {}
```

- [ ] **`entities/request.ts`** — Entity mit Invarianten (Submit-Regel lebt HIER, nicht im Use-Case):

```ts
import { RequestStatus } from '../value-objects/request-status';
import { NotRequestOwner, RequestNotEditable } from '../errors';

export interface RequestPayload {
  category: 'purchase' | 'travel' | 'access' | 'other';
  description: string;
  amountEur?: number;
  neededBy?: string; // ISO date
}

export class Request {
  constructor(
    public readonly id: string,
    public title: string,
    public payload: RequestPayload,
    public status: RequestStatus,
    public readonly requesterId: string,
    public reviewerId: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  private assertOwnedBy(userId: string): void {
    if (this.requesterId !== userId) throw new NotRequestOwner();
  }

  updateDraft(userId: string, title: string, payload: RequestPayload): void {
    this.assertOwnedBy(userId);
    if (this.status !== RequestStatus.Draft) throw new RequestNotEditable();
    this.title = title;
    this.payload = payload;
  }

  submit(userId: string): void {
    this.assertOwnedBy(userId);
    if (this.status !== RequestStatus.Draft) throw new RequestNotEditable();
    this.status = RequestStatus.Submitted;
  }
}
```

- [ ] **`repositories/request.repository.ts`**:

```ts
import { Request } from '../entities/request';

export const REQUEST_REPOSITORY = Symbol('REQUEST_REPOSITORY');

export interface RequestRepository {
  findById(id: string): Promise<Request | null>;
  findByRequester(requesterId: string): Promise<Request[]>;
  findAll(): Promise<Request[]>;
  create(input: {
    title: string;
    payload: Request['payload'];
    requesterId: string;
  }): Promise<Request>;
  save(request: Request): Promise<void>;
}
```

- [ ] Gates + Commit `feat(requests): add request domain with submit/edit invariants`.

### Task 2: Infrastructure + Migration

**Files:**
- Create: `backend/src/requests/infrastructure/persistence/request.orm-entity.ts`
- Create: `backend/src/requests/infrastructure/repositories/typeorm-request.repository.ts`
- Create: `backend/src/requests/requests.module.ts`
- Create: `backend/src/migrations/<ts>-CreateRequests.ts` (generiert)

- [ ] **`request.orm-entity.ts`**:

```ts
import {
  Column, CreateDateColumn, Entity, Index,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { RequestPayload } from '../../domain/entities/request';
import { RequestStatus } from '../../domain/value-objects/request-status';

@Entity('requests')
export class RequestOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'jsonb' })
  payload!: RequestPayload;

  @Column({ type: 'enum', enum: RequestStatus, enumName: 'request_status', default: RequestStatus.Draft })
  status!: RequestStatus;

  @Index()
  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId!: string;

  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
```

- [ ] **`typeorm-request.repository.ts`** (Mapping wie bei users; `create` setzt Status Draft):

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from '../../domain/entities/request';
import { RequestRepository } from '../../domain/repositories/request.repository';
import { RequestOrmEntity } from '../persistence/request.orm-entity';

@Injectable()
export class TypeormRequestRepository implements RequestRepository {
  constructor(
    @InjectRepository(RequestOrmEntity)
    private readonly repo: Repository<RequestOrmEntity>,
  ) {}

  async findById(id: string): Promise<Request | null> {
    return this.toDomain(await this.repo.findOneBy({ id }));
  }

  async findByRequester(requesterId: string): Promise<Request[]> {
    const rows = await this.repo.find({ where: { requesterId }, order: { updatedAt: 'DESC' } });
    return rows.map((r) => this.toDomain(r)!);
  }

  async findAll(): Promise<Request[]> {
    const rows = await this.repo.find({ order: { updatedAt: 'DESC' } });
    return rows.map((r) => this.toDomain(r)!);
  }

  async create(input: { title: string; payload: Request['payload']; requesterId: string }): Promise<Request> {
    const row = await this.repo.save(this.repo.create(input));
    return this.toDomain(row)!;
  }

  async save(request: Request): Promise<void> {
    await this.repo.update(request.id, {
      title: request.title,
      payload: request.payload,
      status: request.status,
      reviewerId: request.reviewerId,
    });
  }

  private toDomain(row: RequestOrmEntity | null): Request | null {
    if (!row) return null;
    return new Request(row.id, row.title, row.payload, row.status, row.requesterId, row.reviewerId, row.createdAt, row.updatedAt);
  }
}
```

- [ ] **`requests.module.ts`** (Port exportieren, Controller kommt in Task 3):

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { REQUEST_REPOSITORY } from './domain/repositories/request.repository';
import { RequestOrmEntity } from './infrastructure/persistence/request.orm-entity';
import { TypeormRequestRepository } from './infrastructure/repositories/typeorm-request.repository';

@Module({
  imports: [TypeOrmModule.forFeature([RequestOrmEntity])],
  providers: [{ provide: REQUEST_REPOSITORY, useClass: TypeormRequestRepository }],
  exports: [REQUEST_REPOSITORY],
})
export class RequestsModule {}
```

- [ ] In `app.module.ts` registrieren · `npm run migration:generate src/migrations/CreateRequests` · `npm run migration:run` · `\dt` zeigt `requests`.
- [ ] Gates + Commit `feat(requests): add typeorm persistence and migration`.

### Task 3: Use-Cases (TDD) + Controller

**Files:**
- Create: `backend/src/requests/application/dto/create-request.dto.ts`, `request-response.dto.ts`
- Create: `backend/src/requests/application/manage-requests.use-case.ts`
- Test: `backend/src/requests/application/manage-requests.use-case.spec.ts`
- Create: `backend/src/requests/application/requests.controller.ts`
- Create: `backend/src/shared/filters/domain-error.filter.ts`

- [ ] **DTO** (`create-request.dto.ts`, auch für Update benutzt):

```ts
import { Type } from 'class-transformer';
import {
  IsDateString, IsIn, IsNumber, IsOptional, IsString,
  MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export class RequestPayloadDto {
  @IsIn(['purchase', 'travel', 'access', 'other'])
  category!: 'purchase' | 'travel' | 'access' | 'other';

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountEur?: number;

  @IsOptional()
  @IsDateString()
  neededBy?: string;
}

export class CreateRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @ValidateNested()
  @Type(() => RequestPayloadDto)
  payload!: RequestPayloadDto;
}
```

- [ ] **FAILING TESTS zuerst** (`manage-requests.use-case.spec.ts`) — In-Memory-Repo-Fake, Fälle: requester listet nur eigene / reviewer listet alle / update fremder Antrag wirft `NotRequestOwner` / update non-draft wirft `RequestNotEditable` / submit setzt Status auf submitted / get fremder Antrag als requester wirft `NotRequestOwner`:

```ts
import { Request, RequestPayload } from '../domain/entities/request';
import { NotRequestOwner, RequestNotEditable } from '../domain/errors';
import { RequestRepository } from '../domain/repositories/request.repository';
import { RequestStatus } from '../domain/value-objects/request-status';
import { Role } from '../../users/domain/value-objects/role';
import { ManageRequestsUseCase } from './manage-requests.use-case';

const payload: RequestPayload = { category: 'other', description: 'Zehn Zeichen mindestens' };
const req = (id: string, owner: string, status = RequestStatus.Draft) =>
  new Request(id, 'Test', payload, status, owner, null, new Date(), new Date());

class FakeRepo implements RequestRepository {
  constructor(public rows: Request[] = []) {}
  findById = async (id: string) => this.rows.find((r) => r.id === id) ?? null;
  findByRequester = async (uid: string) => this.rows.filter((r) => r.requesterId === uid);
  findAll = async () => this.rows;
  create = async (input: { title: string; payload: RequestPayload; requesterId: string }) => {
    const created = req(`r${this.rows.length + 1}`, input.requesterId);
    created.title = input.title;
    this.rows.push(created);
    return created;
  };
  save = async () => undefined;
}

const requester = { sub: 'u1', email: 'r@x.de', role: Role.Requester };
const reviewer = { sub: 'u2', email: 'v@x.de', role: Role.Reviewer };

describe('ManageRequestsUseCase', () => {
  it('lists only own requests for a requester, all for a reviewer', async () => {
    const uc = new ManageRequestsUseCase(new FakeRepo([req('a', 'u1'), req('b', 'u9')]));
    expect((await uc.list(requester)).map((r) => r.id)).toEqual(['a']);
    expect((await uc.list(reviewer))).toHaveLength(2);
  });

  it('creates a draft owned by the caller', async () => {
    const uc = new ManageRequestsUseCase(new FakeRepo());
    const created = await uc.create(requester, { title: 'Neuer Antrag', payload });
    expect(created.status).toBe(RequestStatus.Draft);
    expect(created.requesterId).toBe('u1');
  });

  it('rejects updating a foreign request', async () => {
    const uc = new ManageRequestsUseCase(new FakeRepo([req('a', 'u9')]));
    await expect(uc.update(requester, 'a', { title: 'Hack', payload })).rejects.toBeInstanceOf(NotRequestOwner);
  });

  it('rejects updating a non-draft', async () => {
    const uc = new ManageRequestsUseCase(new FakeRepo([req('a', 'u1', RequestStatus.Submitted)]));
    await expect(uc.update(requester, 'a', { title: 'Spät', payload })).rejects.toBeInstanceOf(RequestNotEditable);
  });

  it('submits an own draft', async () => {
    const repo = new FakeRepo([req('a', 'u1')]);
    const uc = new ManageRequestsUseCase(repo);
    const submitted = await uc.submit(requester, 'a');
    expect(submitted.status).toBe(RequestStatus.Submitted);
  });

  it('hides foreign requests from a requester on get', async () => {
    const uc = new ManageRequestsUseCase(new FakeRepo([req('a', 'u9')]));
    await expect(uc.get(requester, 'a')).rejects.toBeInstanceOf(NotRequestOwner);
  });
});
```

- [ ] **Use-Case** (`manage-requests.use-case.ts`):

```ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../../shared/types/auth-user';
import { Role } from '../../users/domain/value-objects/role';
import { Request, RequestPayload } from '../domain/entities/request';
import { NotRequestOwner } from '../domain/errors';
import { REQUEST_REPOSITORY } from '../domain/repositories/request.repository';
import type { RequestRepository } from '../domain/repositories/request.repository';

export interface RequestInput {
  title: string;
  payload: RequestPayload;
}

@Injectable()
export class ManageRequestsUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
  ) {}

  list(user: AuthUser): Promise<Request[]> {
    return user.role === Role.Requester
      ? this.requests.findByRequester(user.sub)
      : this.requests.findAll();
  }

  async get(user: AuthUser, id: string): Promise<Request> {
    const request = await this.requests.findById(id);
    if (!request) throw new NotFoundException();
    if (user.role === Role.Requester && request.requesterId !== user.sub) {
      throw new NotRequestOwner();
    }
    return request;
  }

  create(user: AuthUser, input: RequestInput): Promise<Request> {
    return this.requests.create({ ...input, requesterId: user.sub });
  }

  async update(user: AuthUser, id: string, input: RequestInput): Promise<Request> {
    const request = await this.requests.findById(id);
    if (!request) throw new NotFoundException();
    request.updateDraft(user.sub, input.title, input.payload); // Invariante in der Entity
    await this.requests.save(request);
    return request;
  }

  async submit(user: AuthUser, id: string): Promise<Request> {
    const request = await this.requests.findById(id);
    if (!request) throw new NotFoundException();
    request.submit(user.sub); // Invariante in der Entity
    await this.requests.save(request);
    return request;
  }
}
```

- [ ] **Domain-Fehler → HTTP** (`shared/filters/domain-error.filter.ts`, global registrieren in `main.ts` via `app.useGlobalFilters(new DomainErrorFilter())`):

```ts
import { ArgumentsHost, Catch, ExceptionFilter, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { NotRequestOwner, RequestNotEditable } from '../../requests/domain/errors';

@Catch(NotRequestOwner, RequestNotEditable)
export class DomainErrorFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): never {
    if (exception instanceof NotRequestOwner) {
      throw new ForbiddenException('Not your request');
    }
    throw new UnprocessableEntityException('Request is not editable in its current status');
  }
}
```
*(Hinweis: Filter wirft Nest-HTTP-Exceptions weiter — alternativ Response direkt bauen; im Plan-Durchgang kurz erklären.)*

- [ ] **Controller** (`requests.controller.ts`):

```ts
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { AuthUser } from '../../shared/types/auth-user';
import { CreateRequestDto } from './dto/create-request.dto';
import { ManageRequestsUseCase } from './manage-requests.use-case';

@Controller('requests')
export class RequestsController {
  constructor(private readonly useCase: ManageRequestsUseCase) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.useCase.list(user);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.useCase.get(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRequestDto) {
    return this.useCase.create(user, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateRequestDto) {
    return this.useCase.update(user, id, dto);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.useCase.submit(user, id);
  }
}
```

- [ ] Module um Controller+UseCase ergänzen · Unit-Tests grün · Gates · Commit `feat(requests): add crud use cases with ownership rules (tdd)`.

### Task 4: e2e-Tests Requests

**Files:** Create: `backend/test/requests.e2e-spec.ts`

- [ ] Flow gegen laufende DB (Login als requester): POST draft → 201 · PUT update → 200 · POST submit → 200 + status submitted · PUT nach submit → 422 · GET als reviewer (zweiter Login) sieht den Antrag · GET fremde UUID als requester → 403/404. Aufbau wie `auth.e2e-spec.ts` (eigene Test-Datensätze, keine Annahmen über vorhandene Daten; angelegte Anträge am Ende via direktem `DataSource`-Cleanup löschen oder mit eindeutigem Titel-Präfix `e2e-` markieren).
- [ ] Gates + Commit `test(requests): add e2e coverage for crud and submit flow`.

### Task 5: Frontend — RequestsService + Liste

**Files:**
- Create: `frontend/src/app/core/requests/request.model.ts` (Interfaces: `RequestPayload`, `WorkflowRequest` mit `id/title/payload/status/requesterId/createdAt/updatedAt`)
- Create: `frontend/src/app/core/requests/requests.service.ts`
- Create: `frontend/src/app/features/requests/request-list/` (Komponente)

- [ ] **Service** — `list()`, `get(id)`, `create(input)`, `update(id, input)`, `submit(id)` via HttpClient gegen `environment.apiUrl`; Liste als Signal (`requests = signal<WorkflowRequest[]>([])`, `reload()`-Methode).
- [ ] **Liste** — Tabelle (Titel, Kategorie, Status-Badge, Aktualisiert), Klick → Detail; Button „Neuer Antrag" → Wizard; Dashboard-Route zeigt künftig die Liste (Platzhaltertext raus).
- [ ] Gates (`ng build`, `ng lint`) + Commit `feat(frontend): add requests service and list view`.

### Task 6: Frontend — Wizard (3 Schritte) — **mit Pascal-Lern-Stelle**

**Files:**
- Create: `frontend/src/app/features/requests/request-wizard/` (Komponente, 3 Schritte)

- [ ] **Form-Aufbau:** ein `FormGroup` mit zwei Sub-Groups — `step1: { title, category }`, `step2: { description, amountEur, neededBy }`; `currentStep = signal(1)`; Template zeigt per `@switch (currentStep())` Schritt 1/2/3; Schritt 3 = Zusammenfassung (read-only) + „Als Entwurf speichern" / „Einreichen".
- [ ] **→ PASCAL-BEITRAG (~10 Zeilen): `nextStep()`/`prevStep()`** — Gerüst mit TODO-Kommentar:
  - `nextStep()`: aktuellen Schritt-FormGroup holen (`this.form.controls.step1` bzw. `step2`) → wenn invalid: `markAllAsTouched()` und stehenbleiben → sonst `currentStep`-Signal +1 (max 3).
  - `prevStep()`: Signal −1 (min 1) — ohne Validierung (zurück ist immer erlaubt).
- [ ] **Speichern:** „Entwurf speichern" → `create`/`update` → zurück zur Liste · „Einreichen" → erst speichern, dann `submit(id)` → Liste. Edit-Modus: Route `/requests/:id/edit` lädt Draft in die Form.
- [ ] Gates + Commit `feat(frontend): add three-step request wizard with reactive forms`.

### Task 7: Detail-Ansicht, Routen, Verifikation, Push

**Files:**
- Create: `frontend/src/app/features/requests/request-detail/` (Komponente)
- Modify: `frontend/src/app/app.routes.ts`

- [ ] **Detail:** alle Felder + Status; bei eigenem Draft: Buttons „Bearbeiten"/„Einreichen".
- [ ] **Routen** (alle hinter `authGuard`): `/requests` (Liste, wird Startseite `''`), `/requests/new` (Wizard), `/requests/:id` (Detail), `/requests/:id/edit` (Wizard im Edit-Modus).
- [ ] **Browser-Verifikation** (Playwright-Script wie Phase 2): Login requester → Wizard ausfüllen (Schritt-Validierung greift: „Weiter" ohne Titel bleibt stehen) → Entwurf speichern → bearbeiten → einreichen → Status submitted in Liste · Login reviewer → sieht den Antrag.
- [ ] Alle Gates FE+BE + `git push`.
- [ ] MEMORY.md §JETZT aktualisieren (Phase 3 done, Phase 4 next).

---

## Definition of Done (Phase 3)
- Requester: Antrag per Wizard anlegen → als Draft speichern → bearbeiten → einreichen (alles im Browser verifiziert).
- Ownership serverseitig erzwungen: fremde Anträge nicht les-/änderbar (403), non-draft nicht editierbar (422) — durch Unit- UND e2e-Tests belegt.
- Reviewer/Admin sehen alle Anträge in der Liste.
- Alle Gates grün (FE `ng build`+`ng lint`, BE `tsc`+`lint`+`test`+`test:e2e`), alles gepusht.
