# FlowGate Phase 4: Status-Maschine + Review + Audit-Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **STATUS: ✅ ABGESCHLOSSEN (10.06.2026)** — Unit 19/19, e2e 18/18, Chrome-Review-Zyklus 10/10 (create→submit→review→changes→resubmit→approve, Timeline 7 Einträge, Filter-Chips). Lern-Stelle transitionTo: von Pascal begonnen, auf seinen Wunsch (keine Zeit) von Claude fertiggestellt.

**Goal:** Reviewer können Anträge prüfen und entscheiden (genehmigen / ablehnen / Änderungen erbitten — mit Kommentar), alle Übergänge werden **serverseitig erzwungen** und **append-only auditiert**; Requester können nach „Änderungen erbeten" nachbessern und neu einreichen. Frontend: Review-Aktionen + Verlaufs-Timeline in der Detailansicht, Status-Filter in der Liste.

**Architecture:** Die Status-Maschine lebt als **Übergangs-Tabelle in der Domain-Entity** (`Request`), jede Aktion ist eine Entity-Methode mit Invarianten. Audit-Events (`request_events`) gehören zum requests-Context und werden im Use-Case mitgeschrieben. Zusätzlich wird je Statuswechsel ein **Domain-Event** über EventEmitter2 emittiert (`request.status-changed`) — noch ohne Consumer; Phase 5 (WebSocket-Gateway) hängt sich dort an. Das erfüllt die CLAUDE.md-Regel „Cross-Modul nur über Domain-Events".

**Status-Maschine (vollständig):**
```
draft ──submit──▶ submitted ──start_review──▶ in_review ──approve──▶ approved
  ▲                                              │ │
  │                                              │ └─reject──▶ rejected
  └── (edit nur in draft/changes_requested)      └─request_changes──▶ changes_requested
                                                                        │
                            submitted ◀──────────resubmit──────────────┘
```

**Decisions (im Durchgang bestätigen):**
1. **Kommentar-Pflicht:** bei `reject` und `request_changes` Pflicht (min. 10 Zeichen), bei `approve` optional. Begründung: Ablehnungen ohne Begründung sind schlechte Praxis.
2. **`start_review` setzt den Reviewer** (`reviewerId` = wer die Prüfung startet). Nur dieser Reviewer (oder Admin) darf dann entscheiden.
3. **Bearbeiten + erneut einreichen** ist in `changes_requested` erlaubt (gleiche Endpoints wie Draft-Edit/Submit — die Entity erlaubt beide Ausgangsstati).
4. **Board-Ansicht (Kanban-Spalten)** kommt erst in Phase 5 zusammen mit den Live-Updates — Phase 4 ergänzt nur einen Status-Filter über der Tabelle.
5. **Lern-Stelle (optional, ~10 Zeilen):** die `canTransition`-Prüfung in der Entity (Übergangs-Tabelle abfragen).

---

### Task 1: Domain — Übergangs-Tabelle, Review-Methoden, RequestEvent

**Files:**
- Modify: `backend/src/requests/domain/entities/request.ts`
- Modify: `backend/src/requests/domain/errors.ts` (+ `InvalidStatusTransition`, `NotAssignedReviewer`)
- Create: `backend/src/requests/domain/entities/request-event.ts`
- Create: `backend/src/requests/domain/repositories/request-event.repository.ts`

- [ ] **Übergangs-Tabelle + Guard in `request.ts`:**

```ts
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.Draft]: [RequestStatus.Submitted],
  [RequestStatus.Submitted]: [RequestStatus.InReview],
  [RequestStatus.InReview]: [RequestStatus.Approved, RequestStatus.Rejected, RequestStatus.ChangesRequested],
  [RequestStatus.ChangesRequested]: [RequestStatus.Submitted],
  [RequestStatus.Approved]: [],
  [RequestStatus.Rejected]: [],
};

const EDITABLE: RequestStatus[] = [RequestStatus.Draft, RequestStatus.ChangesRequested];

private transitionTo(next: RequestStatus): void {
  if (!TRANSITIONS[this.status].includes(next)) throw new InvalidStatusTransition();
  this.status = next;
}
```

- [ ] **Methoden** (alle geben `{from, to}` für den Audit-Eintrag zurück):
  - `submit(userId)` — Owner-Check, `transitionTo(Submitted)` (gilt damit auch für Resubmit aus changes_requested)
  - `updateDraft(userId, …)` — Owner-Check + `EDITABLE.includes(status)`
  - `startReview(reviewerId)` — `transitionTo(InReview)`, setzt `this.reviewerId = reviewerId`
  - `decide(reviewerId, decision)` — wirft `NotAssignedReviewer`, wenn `reviewerId !== this.reviewerId` (Admin-Bypass regelt der Use-Case), `transitionTo(decision)`

- [ ] **`request-event.ts`** (immutable Audit-Eintrag):

```ts
export class RequestEvent {
  constructor(
    public readonly id: string,
    public readonly requestId: string,
    public readonly actorId: string,
    public readonly action: string,           // created | submitted | review_started | approved | rejected | changes_requested
    public readonly fromStatus: RequestStatus | null,
    public readonly toStatus: RequestStatus,
    public readonly comment: string | null,
    public readonly createdAt: Date,
  ) {}
}
```

- [ ] **`request-event.repository.ts`:** `REQUEST_EVENT_REPOSITORY` Token + Interface `{ append(input): Promise<RequestEvent>; listByRequest(requestId): Promise<RequestEvent[]> }` — bewusst **kein** update/delete (append-only).

### Task 2: Infrastructure + Migration

**Files:**
- Create: `backend/src/requests/infrastructure/persistence/request-event.orm-entity.ts` (`request_events`: id uuid, request_id FK+Index, actor_id, action, from_status nullable, to_status, comment nullable, created_at)
- Create: `backend/src/requests/infrastructure/repositories/typeorm-request-event.repository.ts`
- Modify: `requests.module.ts` (Provider + forFeature), Migration `CreateRequestEvents` generieren + ausführen

### Task 3: Review-Use-Case (TDD) + Audit + Domain-Event

**Files:**
- Create: `backend/src/requests/application/dto/decision.dto.ts` (`decision: 'approved'|'rejected'|'changes_requested'`, `comment?: string` — Pflicht ab reject/changes via custom `ValidateIf`)
- Create: `backend/src/requests/application/review-request.use-case.ts` + `.spec.ts`
- Modify: `manage-requests.use-case.ts` (create/submit schreiben jetzt auch Audit-Events; `get` liefert Events mit ODER eigener Endpoint)
- Modify: `app.module.ts` (`EventEmitterModule.forRoot()`), `npm i @nestjs/event-emitter`

- [ ] **Tests zuerst** (mind. 8): start_review setzt reviewer & Status · decide nur durch zugewiesenen Reviewer (sonst `NotAssignedReviewer`) · Admin darf immer entscheiden · approve/reject/changes setzen Status · illegale Übergänge werfen `InvalidStatusTransition` (z.B. decide auf submitted, submit auf approved) · resubmit aus changes_requested · Audit-Append wird je Aktion mit korrektem from/to aufgerufen.
- [ ] **Use-Case:** lädt Request, ruft Entity-Methode, `save`, `events.append(...)`, `eventEmitter.emit('request.status-changed', { requestId, from, to, actorId })`, gibt Request zurück.
- [ ] **Endpoints** (`requests.controller.ts`): `POST /requests/:id/start-review` + `POST /requests/:id/decision` (beide `@Roles(Reviewer, Admin)`), `GET /requests/:id/events` (Owner/Reviewer/Admin). Submit-/Create-Pfade aus Phase 3 schreiben jetzt ebenfalls Audit-Einträge.

### Task 4: e2e — kompletter Lebenszyklus

- [ ] `test/review.e2e-spec.ts`: Requester erstellt+submitted → Reviewer start-review → decision `changes_requested` (mit Kommentar) → Requester editiert + resubmitted → Reviewer (derselbe) approved → `GET /:id/events` zeigt **6 Einträge in korrekter Reihenfolge** · Negativfälle: Requester ruft start-review auf (403) · zweiter Reviewer versucht decision (403/422) · decision ohne Kommentar bei reject (400) · approve auf bereits approved (422).

### Task 5: Frontend — Review-Aktionen + Timeline in der Detailansicht

**Files:**
- Modify: `requests.service.ts` (+ `startReview`, `decide`, `events`), `request.model.ts` (+ `RequestEvent`, `ACTION_LABELS`)
- Modify: `request-detail/` (Aktionen nach Rolle+Status, Kommentar-Textarea, Timeline)

- [ ] **Aktions-Logik** (computed, analog `canEdit`): Reviewer/Admin + `submitted` → „Prüfung starten" · zugewiesener Reviewer/Admin + `in_review` → Entscheidungs-Panel (3 Buttons + Kommentarfeld, Pflicht-Validierung clientseitig gespiegelt) · Owner + `changes_requested` → „Bearbeiten" + „Erneut einreichen".
- [ ] **Timeline** unter der Info-Karte: vertikale Liste der Events (Mono-Zeitstempel, Aktions-Label, Kommentar als eingerücktes Zitat, Stempel-Farbe je Zielstatus) — Amtsakte-Ästhetik konsistent zum Design-System.

### Task 6: Frontend — Status-Filter in der Liste

- [ ] Filter-Chips über der Tabelle (Alle · Entwurf · Eingereicht · In Prüfung · Genehmigt · Abgelehnt · Änderungen erbeten) als Signal + computed-Filter. Aktiver Chip im Stempel-Stil.

### Task 7: Verifikation + Abschluss

- [ ] Chrome-Flow (Playwright): Requester submitted → Reviewer startet Prüfung + erbittet Änderungen mit Kommentar → Requester sieht Kommentar in Timeline, editiert, resubmitted → Reviewer genehmigt → Timeline zeigt alles; Filter-Chips funktionieren.
- [ ] Alle Gates FE+BE, Push, Plan-Status + MEMORY.md aktualisieren.

---

## Definition of Done (Phase 4)
- Alle 6 Übergänge funktionieren end-to-end, illegale Übergänge werden serverseitig mit 422 abgelehnt (e2e-belegt).
- Kommentar-Pflicht bei reject/changes_requested (400 ohne).
- Append-only Audit-Trail vollständig (jede Statusänderung + create), Timeline im Frontend sichtbar.
- Domain-Event `request.status-changed` wird emittiert (Phase-5-Anschlusspunkt).
- Gates grün, gepusht.
