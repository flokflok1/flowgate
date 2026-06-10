# FlowGate

A full-stack **multi-step approval / request workflow** application — built as a reference project.

**Stack:** Angular (standalone components, Reactive Forms, signals) · NestJS · PostgreSQL (TypeORM) · WebSocket (real-time) · JWT auth.

**What it does:** requests move through a server-enforced state machine (Draft → Submitted → In Review → Approved/Rejected) with role-based access (requester / reviewer / admin), a live status board updated over WebSocket, and an append-only audit trail.

> Status: in development. Self-built reference/demo project — generic demo data, no real client data.

See `SPEC.md` for the full specification.
