# FlowGate — Spezifikation

Eigenständiges Full-Stack-Referenzprojekt (Angular + NestJS + PostgreSQL + WebSocket).
Zweck: Angular-Kompetenz ehrlich belegen + Backend-Stärke zeigen → Portfolio / Freelance.
**Keine TideLane-Vermischung** (siehe `CLAUDE.md`).

---

## 1. Produkt-Idee
Ein **mehrstufiger Antrags-/Freigabe-Workflow** (generisch, enterprise-typisch). Beispiel-Domäne bewusst neutral gehalten (z.B. „interne Anträge / Freigaben"), damit es als Vorlage für Logistik-/Workflow-Projekte taugt.

**Status-Maschine eines Antrags:**
`Draft → Submitted → In Review → (Approved | Rejected)` (+ optional `Changes Requested → Submitted`).

**Rollen:**
- **Requester** — erstellt/bearbeitet eigene Anträge, reicht ein.
- **Reviewer** — sieht zugewiesene Anträge, genehmigt/lehnt ab (mit Kommentar).
- **Admin** — sieht alles, verwaltet Nutzer/Rollen.

## 2. MVP (Phase 1–5)
- **Auth:** Login (JWT), 3 Rollen, Route-Guards (Angular) + Guards/RBAC (NestJS).
- **Antrag anlegen:** Angular **Reactive Form**, mehrstufig (Wizard), Client- + Server-Validierung (class-validator/DTOs).
- **Liste/Board:** Status-Spalten (Draft/Submitted/In Review/Done), Filter nach Status/Rolle, Tabelle + Detailansicht.
- **Review-Aktionen:** approve/reject + Kommentar → Status-Maschine serverseitig erzwungen (keine illegalen Übergänge).
- **Echtzeit:** WebSocket-Gateway — Statusänderung pusht Live-Update an alle Clients (Board aktualisiert ohne Reload).
- **Audit-Trail:** wer/was/wann pro Antrag (append-only).
- **Backend:** NestJS-Module `auth`, `users`, `requests` (+ `events`/Gateway); TypeORM + PostgreSQL; Migrations.

## 3. Stretch (nice-to-have, fürs „wow")
- Redis (Sessions/Cache/Rate-Limit) · BullMQ-Worker (async E-Mail-Benachrichtigung bei Statuswechsel).
- e2e-Tests (Playwright/Cypress) + Backend-Unit-Tests (Jest).
- Dockerfile + docker-compose (Postgres+Redis) für reproduzierbares Setup.
- Multi-Tenancy-Light (mandantenfähig per `tenant_id`) — zeigt das RLS-Pattern (ohne TideLane-Code).
- i18n (DE/EN) im Angular-Frontend.

## 4. Repo-Struktur
```
flowgate/
├── CLAUDE.md            # Projekt-Kontext (auto-load)
├── SPEC.md              # diese Datei
├── README.md           # öffentlich (Portfolio)
├── docker-compose.yml  # dev: PostgreSQL (+ Redis stretch)
├── frontend/           # Angular (standalone, routing, signals)
└── backend/            # NestJS (auth/users/requests/events) + TypeORM
└── docs/               # Case-Study + Architektur-Bild (fürs Portfolio)
```

## 5. Datenmodell (Skizze)
- `users` (id, email, password_hash, role, created_at)
- `requests` (id, title, payload jsonb, status, requester_id, reviewer_id, created_at, updated_at)
- `request_events` (id, request_id, actor_id, action, from_status, to_status, comment, created_at)  ← Audit-Trail

## 6. Roadmap (kleine Schritte, früh lauffähig)
1. **Scaffold:** `nest new backend`, `ng new frontend` (standalone+routing), `docker-compose` mit Postgres.
2. **Auth:** Registrierung/Login (JWT), Rollen, Guards beidseitig.
3. **Requests CRUD:** Reactive Wizard-Form + Liste/Detail + REST `/api/v1`.
4. **Status-Maschine + Review:** serverseitige Übergangs-Validierung, approve/reject + Kommentar, Audit-Events.
5. **Echtzeit:** WebSocket-Gateway → Live-Board.
6. **Polish + Deploy + Case-Study:** auf Pascals Infra deployen (hinter Reverse-Proxy/HTTPS), öffentliches GitHub-Repo, anonymisierte Mini-Case-Study (4. Portfolio-Eintrag, gleicher Stil wie die anderen).

## 7. Definition of Done (Portfolio-tauglich)
- Läuft deployed über HTTPS, öffentliches GitHub-Repo, sauberes README mit Screenshots.
- `tsc --noEmit` + Lint grün (FE+BE), Basistests vorhanden.
- 0 Secrets im Repo, generische Demo-Daten, kein TideLane-Bezug.
- Case-Study + Architektur-Bild im `docs/` (für Upwork-Eintrag).
