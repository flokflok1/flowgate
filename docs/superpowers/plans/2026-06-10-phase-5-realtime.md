# FlowGate Phase 5: WebSocket-Live-Updates + Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **STATUS: BESTÄTIGT (10.06.2026)** — 4 Spalten; Lern-Stelle Board-Gruppierung im „Lehrer-Modus" (Konzept-Lektion → geführtes Schreiben).

**Goal:** Statusänderungen erscheinen **live in allen offenen Browsern** (ohne Reload) — sichtbar gemacht durch eine **Board-Ansicht** (Status-Spalten) zusätzlich zur Tabelle, plus dezente Toast-Benachrichtigung.

**Architecture:** Neuer Bounded Context `events` (bewusst schlank — nur Gateway, kein DDD-Layering nötig, SPEC §4a Proportionalitätsregel). Der `RequestsGateway` (socket.io) **lauscht per `@OnEvent` auf das vorhandene Domain-Event** `request.status-changed` — der requests-Context bleibt unangetastet (genau dafür wurde das Event in Phase 4 gebaut; einzige Erweiterung: das Event trägt zusätzlich `requesterId` + `title` für Ziel-Adressierung und Toast-Text). **Sichtbarkeitsregeln gelten auch im Socket:** Beim Verbinden wird das JWT aus dem Handshake verifiziert; Requester joinen Raum `user:<id>`, Reviewer/Admins Raum `reviewers`. Ein Event geht nur an `reviewers` + `user:<requesterId>` — fremde Requester sehen nichts (gleiche Regel wie REST).

**Pfad-Trick:** socket.io läuft unter `path: '/api/socket.io'` — damit deckt der vorhandene `/api`-Proxy (Dev-Proxy UND Prod-nginx, Upgrade-Header sind schon gesetzt) das WebSocket gleich mit ab. Dev-Proxy braucht nur `"ws": true`.

**Decisions (im Durchgang bestätigen):**
1. **Board-Spalten:** 4 Spalten — Entwurf · Eingereicht/Änderungen · In Prüfung · Entschieden (Genehmigt+Abgelehnt mit Badge unterscheidbar). Alternative: 6 Spalten (eine je Status).
2. **Update-Strategie:** Bei jedem Event lädt der Client die Liste neu (`reload()`) — simpel, immer konsistent, bei Demo-Datenmengen völlig ausreichend (kein fragiles Client-State-Patching).
3. **Toast:** dezente Einblendung unten rechts („‚Bürostuhl' wurde genehmigt"), verschwindet nach 5s.
4. **Lern-Stelle (optional):** die Gruppierungs-Funktion fürs Board (Anträge → Spalten, ~10 Zeilen `computed` + `filter`).

---

### Task 1: Backend — Domain-Event erweitern + `events`-Context (Gateway)

**Files:**
- Modify: `backend/src/requests/domain/events/request-status-changed.event.ts` (+ `requesterId`, `title`)
- Modify: beide Emit-Stellen (`manage-requests.use-case.ts`, `review-request.use-case.ts`)
- Create: `backend/src/events/events.module.ts`, `backend/src/events/requests.gateway.ts`
- Modify: `app.module.ts` (EventsModule)

- [ ] `npm i @nestjs/websockets @nestjs/platform-socket.io socket.io`
- [ ] Event um `requesterId: string` und `title: string` erweitern (beide Use-Cases reichen `request.requesterId`/`request.title` mit).
- [ ] **Gateway:**

```ts
@WebSocketGateway({ path: '/api/socket.io', cors: { origin: true } })
export class RequestsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      const user = await this.jwt.verifyAsync<AuthUser>(token ?? '');
      await client.join(`user:${user.sub}`);
      if (user.role !== Role.Requester) await client.join('reviewers');
    } catch {
      client.disconnect(true); // no valid token — no socket
    }
  }

  @OnEvent(RequestStatusChangedEvent.eventName)
  onStatusChanged(event: RequestStatusChangedEvent): void {
    this.server
      .to('reviewers')
      .to(`user:${event.requesterId}`)
      .emit('request.status-changed', event);
  }
}
```

- [ ] Unit-Test: ungültiges Token → disconnect · Event → emit an beide Räume (Server/Socket gemockt).
- [ ] Gates + Commit.

### Task 2: Dev-Proxy + Prod-Check

- [ ] `frontend/proxy.conf.json`: `"ws": true` ergänzen.
- [ ] Prod-`nginx.conf`: bereits ok (Upgrade-Header in `/api/` vorhanden) — nur verifizieren.

### Task 3: Frontend — RealtimeService + Live-Reload + Toast

**Files:**
- Create: `frontend/src/app/core/realtime/realtime.service.ts`
- Create: `frontend/src/app/core/realtime/toast.ts` (Komponente, im App-Root)
- Modify: `request-list.ts`, `request-detail.ts`, `app.ts`/`app.html`

- [ ] `npm i socket.io-client`
- [ ] **RealtimeService:** verbindet bei Login (`io({ path: '/api/socket.io', auth: { token } })`), trennt bei Logout; eingehende Events als Signal `lastEvent` + Toast-Queue.
- [ ] **Liste:** `effect()` auf `lastEvent` → `requestsService.reload()`.
- [ ] **Detail:** Event mit passender `requestId` → `load(id)` (Timeline + Status aktualisieren sich live).
- [ ] **Toast:** „‚<Titel>' → <Status-Label>" unten rechts, auto-dismiss 5s, `role="status"`.
- [ ] Gates + Commit.

### Task 4: Board-Ansicht (Tabelle ⇄ Board umschaltbar)

**Files:**
- Modify: `request-list.ts/html/scss` (View-Toggle + Board)

- [ ] Toggle-Buttons (Tabelle/Board, Wahl in `localStorage`).
- [ ] **Board:** 4 Spalten (Decision 1), Karten mit Titel/Kategorie/Betrag/Badge, Klick → Detail. Spaltenkopf mit Anzahl. Filter-Chips wirken auch aufs Board.
- [ ] **Gruppierung** = Lern-Stelle (falls gewünscht): `computed`, das `filtered()` in die 4 Spalten verteilt.
- [ ] Gates + Commit.

### Task 5: Live-Verifikation mit ZWEI Browsern + Abschluss

- [ ] Playwright: zwei getrennte Browser-Kontexte — A: Requester auf dem Board · B: Reviewer genehmigt einen Antrag → **A's Board aktualisiert sich ohne Reload** (Karte wechselt Spalte, Toast erscheint). Screenshot beider Fenster.
- [ ] Prod-Stack neu bauen (`docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build`) und Live-Update auch dort verifizieren (über :8081).
- [ ] Alle Gates FE+BE, Push, Plan + MEMORY.md aktualisieren.

---

## Definition of Done (Phase 5)
- Zwei-Browser-Test: Statuswechsel erscheint im anderen Browser < 2s ohne Reload (Tabelle UND Board).
- Socket nur mit gültigem JWT; Requester erhalten keine Events fremder Anträge (Raum-Logik unit-getestet).
- Board-Ansicht mit 4 Spalten, umschaltbar, Filter funktionieren.
- Prod-Stack aktualisiert und live verifiziert. Gates grün, gepusht.
