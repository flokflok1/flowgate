import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { RequestPayload } from './requests/domain/entities/request';
import { RequestStatus } from './requests/domain/value-objects/request-status';
import { RequestOrmEntity } from './requests/infrastructure/persistence/request.orm-entity';
import { Role } from './users/domain/value-objects/role';
import { UserOrmEntity } from './users/infrastructure/persistence/user.orm-entity';

const DEMO_USERS: Array<{ email: string; role: Role }> = [
  { email: 'admin@flowgate.demo', role: Role.Admin },
  { email: 'reviewer@flowgate.demo', role: Role.Reviewer },
  { email: 'requester@flowgate.demo', role: Role.Requester },
];

// sample requests covering every status, so the demo board never looks empty
const DEMO_REQUESTS: Array<{
  title: string;
  status: RequestStatus;
  payload: RequestPayload;
  reviewed: boolean;
}> = [
  {
    title: 'Ergonomischer Bürostuhl',
    status: RequestStatus.Approved,
    reviewed: true,
    payload: {
      category: 'purchase',
      description:
        'Ersatz für den defekten Stuhl am Arbeitsplatz 4, ergonomisch mit Lordosenstütze.',
      amountEur: 380,
    },
  },
  {
    title: 'Messebesuch LogiData Stuttgart',
    status: RequestStatus.InReview,
    reviewed: true,
    payload: {
      category: 'travel',
      description:
        'Zweitägiger Messebesuch inkl. Anreise und Übernachtung, Fokus Lager-Automatisierung.',
      amountEur: 890,
      neededBy: '2026-09-15',
    },
  },
  {
    title: 'VPN-Zugang für externen Dienstleister',
    status: RequestStatus.Rejected,
    reviewed: true,
    payload: {
      category: 'access',
      description:
        'Befristeter VPN-Zugang für die Wartung der Lagerverwaltung durch Fremdfirma.',
    },
  },
  {
    title: 'Lizenz Datenbank-Monitoring',
    status: RequestStatus.Submitted,
    reviewed: false,
    payload: {
      category: 'purchase',
      description:
        'Jahreslizenz für das Monitoring-Tool der PostgreSQL-Instanzen im Betrieb.',
      amountEur: 588,
    },
  },
  {
    title: 'Team-Workshop Q3 — Raumbuchung',
    status: RequestStatus.ChangesRequested,
    reviewed: true,
    payload: {
      category: 'other',
      description:
        'Externer Workshop-Raum für zwei Tage, Termin und Teilnehmerzahl noch offen.',
    },
  },
  {
    title: 'Zweiter Monitor für Homeoffice',
    status: RequestStatus.Draft,
    reviewed: false,
    payload: {
      category: 'purchase',
      description:
        'Zweiter 27-Zoll-Monitor für produktiveres Arbeiten im Homeoffice.',
      amountEur: 249,
    },
  },
];

// Demo default is intentional (published in README for the demo app).
// Per-role override (e.g. SEED_PASSWORD_ADMIN) lets a deployed instance keep
// the admin credential private while requester/reviewer stay public.
function passwordFor(role: Role): string {
  return (
    process.env[`SEED_PASSWORD_${role.toUpperCase()}`] ??
    process.env.SEED_PASSWORD ??
    'Demo1234!'
  );
}

async function seed(): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ALLOW_PROD_SEED !== 'true'
  ) {
    throw new Error(
      'Refusing to seed in production (set ALLOW_PROD_SEED=true to override)',
    );
  }
  await dataSource.initialize();
  const repo = dataSource.getRepository(UserOrmEntity);

  for (const { email, role } of DEMO_USERS) {
    if (await repo.existsBy({ email })) {
      console.log(`skip (exists): ${email}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(passwordFor(role), 10);
    await repo.save(repo.create({ email, passwordHash, role }));
    console.log(`created: ${email} (${role})`);
  }

  const requester = await repo.findOneByOrFail({
    email: 'requester@flowgate.demo',
  });
  const reviewer = await repo.findOneByOrFail({
    email: 'reviewer@flowgate.demo',
  });
  const requestRepo = dataSource.getRepository(RequestOrmEntity);

  for (const { title, status, payload, reviewed } of DEMO_REQUESTS) {
    if (await requestRepo.existsBy({ title })) {
      console.log(`skip (exists): ${title}`);
      continue;
    }
    await requestRepo.save(
      requestRepo.create({
        title,
        status,
        payload,
        requesterId: requester.id,
        reviewerId: reviewed ? reviewer.id : null,
      }),
    );
    console.log(`created: ${title} (${status})`);
  }

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
