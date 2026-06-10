import * as bcrypt from 'bcrypt';
import dataSource from './data-source';
import { Role } from './users/domain/value-objects/role';
import { UserOrmEntity } from './users/infrastructure/persistence/user.orm-entity';

const DEMO_USERS: Array<{ email: string; role: Role }> = [
  { email: 'admin@flowgate.demo', role: Role.Admin },
  { email: 'reviewer@flowgate.demo', role: Role.Reviewer },
  { email: 'requester@flowgate.demo', role: Role.Requester },
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
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
