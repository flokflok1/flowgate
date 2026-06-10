import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainErrorFilter } from '../src/shared/filters/domain-error.filter';

const TITLE = `e2e-review-${process.pid}`;

describe('Review lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let requesterToken: string;
  let reviewerToken: string;
  let adminToken: string;
  let id: string;

  const login = async (email: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Demo1234!' })
      .expect(200);
    return (res.body as { accessToken: string }).accessToken;
  };

  const payload = {
    category: 'purchase',
    description: 'Testgerät für die Qualitätssicherung',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
    dataSource = moduleRef.get(DataSource);
    requesterToken = await login('requester@flowgate.demo');
    reviewerToken = await login('reviewer@flowgate.demo');
    adminToken = await login('admin@flowgate.demo');
  });

  afterAll(async () => {
    await dataSource.query(
      `DELETE FROM request_events WHERE request_id IN (SELECT id FROM requests WHERE title LIKE 'e2e-review-%')`,
    );
    await dataSource.query(
      `DELETE FROM requests WHERE title LIKE 'e2e-review-%'`,
    );
    await app.close();
  });

  it('full lifecycle: create → submit → review → changes → resubmit → approve', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: TITLE, payload })
      .expect(201);
    id = (created.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/api/v1/requests/${id}/submit`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/requests/${id}/start-review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/requests/${id}/decision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        decision: 'changes_requested',
        comment: 'Bitte Begründung um Kostenstelle ergänzen.',
      })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/requests/${id}`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        title: TITLE,
        payload: {
          ...payload,
          description: 'Testgerät für QS — Kostenstelle 4711',
        },
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/requests/${id}/submit`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/requests/${id}/start-review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    const approved = await request(app.getHttpServer())
      .post(`/api/v1/requests/${id}/decision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'approved' })
      .expect(200);
    expect((approved.body as { status: string }).status).toBe('approved');
  });

  it('audit trail lists all 7 entries in order', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/requests/${id}/events`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .expect(200);
    const actions = (res.body as Array<{ action: string }>).map(
      (e) => e.action,
    );
    expect(actions).toEqual([
      'created',
      'submitted',
      'review_started',
      'changes_requested',
      'submitted',
      'review_started',
      'approved',
    ]);
  });

  it('requester must not start a review (403)', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: `${TITLE}-neg`, payload })
      .expect(201);
    const negId = (created.body as { id: string }).id;
    await request(app.getHttpServer())
      .post(`/api/v1/requests/${negId}/submit`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/requests/${negId}/start-review`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .expect(403);
  });

  it('a decision without comment on reject → 400', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/requests/${id}/decision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'rejected' })
      .expect(400);
  });

  it('deciding an already approved request → 422 (admin included)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/requests/${id}/decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approved' })
      .expect(422);
  });
});
