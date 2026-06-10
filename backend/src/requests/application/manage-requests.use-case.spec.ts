import { Request, RequestPayload } from '../domain/entities/request';
import { NotRequestOwner, RequestNotEditable } from '../domain/errors';
import { RequestRepository } from '../domain/repositories/request.repository';
import { RequestStatus } from '../domain/value-objects/request-status';
import { Role } from '../../users/domain/value-objects/role';
import { ManageRequestsUseCase } from './manage-requests.use-case';

const payload: RequestPayload = {
  category: 'other',
  description: 'Zehn Zeichen mindestens',
};
const req = (id: string, owner: string, status = RequestStatus.Draft) =>
  new Request(id, 'Test', payload, status, owner, null, new Date(), new Date());

class FakeRepo implements RequestRepository {
  constructor(public rows: Request[] = []) {}
  findById = async (id: string) => this.rows.find((r) => r.id === id) ?? null;
  findByRequester = async (uid: string) =>
    this.rows.filter((r) => r.requesterId === uid);
  findAll = async () => this.rows;
  create = async (input: {
    title: string;
    payload: RequestPayload;
    requesterId: string;
  }) => {
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
    const uc = new ManageRequestsUseCase(
      new FakeRepo([req('a', 'u1'), req('b', 'u9')]),
    );
    expect((await uc.list(requester)).map((r) => r.id)).toEqual(['a']);
    expect(await uc.list(reviewer)).toHaveLength(2);
  });

  it('creates a draft owned by the caller', async () => {
    const uc = new ManageRequestsUseCase(new FakeRepo());
    const created = await uc.create(requester, {
      title: 'Neuer Antrag',
      payload,
    });
    expect(created.status).toBe(RequestStatus.Draft);
    expect(created.requesterId).toBe('u1');
  });

  it('rejects updating a foreign request', async () => {
    const uc = new ManageRequestsUseCase(new FakeRepo([req('a', 'u9')]));
    await expect(
      uc.update(requester, 'a', { title: 'Hack-Versuch', payload }),
    ).rejects.toBeInstanceOf(NotRequestOwner);
  });

  it('rejects updating a non-draft', async () => {
    const uc = new ManageRequestsUseCase(
      new FakeRepo([req('a', 'u1', RequestStatus.Submitted)]),
    );
    await expect(
      uc.update(requester, 'a', { title: 'Zu spät', payload }),
    ).rejects.toBeInstanceOf(RequestNotEditable);
  });

  it('submits an own draft', async () => {
    const uc = new ManageRequestsUseCase(new FakeRepo([req('a', 'u1')]));
    const submitted = await uc.submit(requester, 'a');
    expect(submitted.status).toBe(RequestStatus.Submitted);
  });

  it('hides foreign requests from a requester on get', async () => {
    const uc = new ManageRequestsUseCase(new FakeRepo([req('a', 'u9')]));
    await expect(uc.get(requester, 'a')).rejects.toBeInstanceOf(
      NotRequestOwner,
    );
  });
});
