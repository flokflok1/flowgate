# Case Study: FlowGate — Antrags- & Freigabe-Workflow (Full-Stack)

**Selbst gebautes Referenzprojekt** · Angular 22 · NestJS 11 · PostgreSQL 18 · WebSocket · Docker
**Live:** https://flowgate.kozlowski-it.de · **Code:** https://github.com/Kozlowski-IT/flowgate
**Rolle:** Konzeption, Architektur, Umsetzung, Betrieb — solo

---

## Ausgangslage & Ziel

Mehrstufige Antrags- und Freigabeprozesse („Mitarbeiter beantragt → Prüfer entscheidet → revisionssicher protokolliert") sind einer der häufigsten Anwendungsfälle interner Unternehmens-Software — von Beschaffung über Reisekosten bis Zugriffsanträge. FlowGate bildet diesen Prozess als vollständige, deployte Web-Anwendung ab: ehrlich als Referenzprojekt gekennzeichnet, aber gebaut und betrieben wie für einen Kunden — inklusive Tests, Security-Review, Barrierefreiheit und automatisiertem Zertifikats-Management.

## Der Workflow

`Entwurf → Eingereicht → In Prüfung → Genehmigt / Abgelehnt / Änderungen erbeten → (Nachbessern → erneut Einreichen)`

Drei Rollen mit unterschiedlichen Rechten und Sichtbarkeiten:

| Rolle | Darf |
|---|---|
| **Requester** | eigene Anträge anlegen (3-Schritte-Wizard), bearbeiten (nur Entwurf/Änderungswunsch), einreichen — sieht **nur eigene** Anträge |
| **Reviewer** | Prüfung übernehmen, genehmigen / ablehnen / Änderungen erbitten (Begründungspflicht) — sieht alle Anträge |
| **Admin** | alles, inkl. Nutzerliste; kann Entscheidungen jedes Reviewers übernehmen |

## Architektur-Entscheidungen (Auszug)

**Status-Maschine als Daten, nicht als if-Wald.** Die erlaubten Übergänge stehen in einer Übergangs-Tabelle in der Domain-Entity; jede Aktion validiert dagegen. Illegale Sprünge (z.B. einen abgelehnten Antrag erneut genehmigen) sind auf Domain-Ebene unmöglich und antworten mit HTTP 422 — egal ob der Aufruf per REST, Test oder künftiger Schnittstelle kommt.

**Domain-Driven Design, proportional.** Bounded Contexts (`auth`, `users`, `requests`, `events`) als NestJS-Module mit Schichtung `domain / application / infrastructure`. Die Domain-Schicht ist framework-frei (kein einziger `@nestjs/*`- oder TypeORM-Import — per grep beweisbar); Repository-Interfaces in der Domain, TypeORM-Implementierungen außen, verdrahtet über Dependency-Injection-Tokens.

**Audit-Trail append-only.** Jede Statusänderung wird mit Akteur, Zeitstempel, Von/Nach-Status und Kommentar protokolliert (`request_events`). Das Repository-Interface bietet bewusst kein Update/Delete. Im Frontend als Akten-Timeline sichtbar.

**Echtzeit über Domain-Events.** Statuswechsel feuern ein internes Domain-Event (EventEmitter2); ein WebSocket-Gateway (socket.io) abonniert es und pusht an die Browser — der Geschäftslogik-Code weiß nichts vom WebSocket. Die Sichtbarkeitsregeln der REST-API gelten auch im Socket: Verbindung nur mit gültigem JWT, Requester erhalten ausschließlich Events zu eigenen Anträgen (Raum-Konzept). Sichtbares Ergebnis: Das Kanban-Board aktualisiert sich in allen offenen Fenstern ohne Reload, mit Toast-Benachrichtigung.

**Security in Schichten.** Globale Guards (alles standardmäßig geschützt, `@Public()` als explizite Ausnahme) · Authentifizierung (401) strikt getrennt von Autorisierung (403) · Validierung doppelt (Angular-Formulare für UX, class-validator-DTOs als Wahrheit) · identische Fehlermeldung bei falscher E-Mail und falschem Passwort (kein User-Enumeration) · bcrypt-Hashing · Demo-Admin mit separatem, nicht veröffentlichtem Passwort · Postgres ohne offenen Port, nur im Container-Netz.

**Barrierefreiheit nach Audit (WCAG 2.1 AA).** Tastatur-erreichbare Tabellenzeilen, Fokus-Management beim Wizard-Schrittwechsel (Screenreader-Ansage), `aria-invalid`/`aria-describedby`-Verkabelung der Formularfehler, Kontrast-geprüfte Farbpalette, `prefers-reduced-motion`.

## Qualitätssicherung

- **23 Unit-Tests** (Jest) — u.a. Status-Maschine, Rollen-Logik, Gateway-Räume; Use-Cases per TDD entwickelt
- **18 End-to-End-API-Tests** (supertest) — kompletter Lebenszyklus inkl. Negativfälle (403/422/400)
- **Browser-Verifikation** (Playwright/Chrome) — inkl. Zwei-Browser-Test für die Echtzeit-Funktion über die öffentliche HTTPS-Strecke
- Quality-Gates vor jedem Commit: `tsc --noEmit` + ESLint (Frontend & Backend), keine Suppressions

## Betrieb

Docker-Multi-Stage-Builds (schlanke Runtime-Images), `docker compose` mit internem Postgres, automatische Migrationen beim Start, nginx mit TLS (Let's-Encrypt-Wildcard per DNS-01, zentrale Ausstellung + automatischer Push/Renewal), gehärtete VPS (Firewall, fail2ban, key-only SSH, Auto-Updates).

## Ergebnis

Eine kleine, aber vollständige Enterprise-Workflow-Anwendung — **öffentlich ausprobierbar** mit Demo-Zugängen direkt auf der Login-Seite. Vom leeren Repo bis zum öffentlichen HTTPS-Deployment, dokumentiert in nachvollziehbaren Commits.

![Login](screenshots/login.png)
![Live-Board](screenshots/live-board.png)
![Detail mit Audit-Timeline](screenshots/detail-timeline.png)

*Architektur-Diagramm: [architecture.svg](architecture.svg)*
