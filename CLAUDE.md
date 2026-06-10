# FlowGate — Angular Full-Stack Workflow/Approval App

> **Arbeitsname „FlowGate" — frei umbenennbar.** Dies ist die Projekt-Kontextdatei (lädt automatisch). Detail-Spezifikation: `SPEC.md`.

## Was & Warum
Ein **eigenständiges Portfolio-/Referenzprojekt**, um die im deutschen Freelance-Markt stark nachgefragte **Angular**-Kompetenz **ehrlich zu belegen** — kombiniert mit der vorhandenen Backend-Stärke. Ziel: eine kleine, aber **echte, deployte, dokumentierte** Full-Stack-App + öffentliches GitHub-Repo + Mini-Case-Study (4. Upwork-Portfolio-Eintrag).

**Die App:** mehrstufiger **Antrags-/Freigabe-Workflow** (Draft → Eingereicht → In Prüfung → Genehmigt/Abgelehnt) mit Rollen, Reactive Forms, Status-Board und **Echtzeit-Updates**. Spiegelt bewusst den „Workflow"-Jobtyp (z.B. Logistik-„Aushandlerworkflow"), den Pascal häufig auf Freelancermap/Upwork sieht.

## 🔴 HARTE REGELN (nicht verhandelbar)
1. **Eigenständiges Projekt — NICHT TideLane.** Kein TideLane-Code, keine TideLane-Namen, -IPs, -Secrets, -Domains, keine proprietäre Logik übernehmen. TideLane darf **nur als Architektur-PATTERN** dienen (NestJS-DDD-Struktur, PostgreSQL-RLS-Idee, WebSocket-Gateway, JWT/2FA-Ansatz). **Alles hier ist Original-Code, generisch.**
2. **Public-Repo-sauber von Tag 1:** keine echten Kundennamen/Secrets/Keys; `.env` nie committen; generische Demo-Daten.
3. **Ehrlich:** Portfolio-/Demo-App — keine „production für echte Kunden"-Behauptungen. „self-built demo / reference project".
4. **Quality-Gates vor Commit:** `tsc --noEmit` + Lint grün (Frontend & Backend). Keine `@ts-ignore`/`eslint-disable`-Workarounds.

## Stack (= der nachgefragte Stack)
- **Frontend:** Angular (aktuell, standalone components, Signals, Reactive Forms, RxJS, Angular Router, HttpClient)
- **Backend:** NestJS (TypeScript, modular/DDD-leicht) + TypeORM
- **DB:** PostgreSQL
- **Echtzeit:** WebSocket (NestJS Gateway ↔ Angular)
- **Auth:** JWT (+ Rollen: requester / reviewer / admin)
- **Stretch:** Redis (Sessions/Cache) · BullMQ (async Notifications) · Docker · e2e-Tests

## Owner / Arbeitsweise
- **Pascal Kozlowski** — Quereinsteiger, FISI-Abschluss 07/2026, starke Backend-/Infra-Skills (NestJS, PostgreSQL, Proxmox), **lernt Angular gerade** (mit Claude Code). Ziel: Freelance.
- **Kommunikation Deutsch · Code/Kommentare/Commits Englisch · Conventional Commits.**
- Vorgehen: erst kurz spec/brainstorm bestätigen → scaffolden (`ng new` Frontend, `nest new` Backend) → in kleinen Schritten bauen, früh lauffähig halten → am Ende auf Pascals Infra deployen + Case-Study schreiben.

## Referenzen (nur als Muster, nichts kopieren)
- Anonymisiertes SaaS-Architektur-Muster: `/home/pascal/bewerbung/portfolio/saas-architektur-en.pdf`
- Portfolio-/CV-Kontext: `/home/pascal/bewerbung/`

## Nächste Schritte (für die neue Session)
1. `SPEC.md` lesen, Feature-Liste/MVP mit Pascal bestätigen.
2. Backend scaffolden (`nest new backend`) + PostgreSQL (lokal/Docker) anbinden.
3. Frontend scaffolden (`ng new frontend`, standalone, routing).
4. Phase 1: Auth + Antrag-CRUD. Dann Status-Workflow → WebSocket-Live → Polish/Deploy/Case-Study.
