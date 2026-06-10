import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { RequestStatusChangedEvent } from '../requests/domain/events/request-status-changed.event';
import { RequestStatus } from '../requests/domain/value-objects/request-status';
import { Role } from '../users/domain/value-objects/role';
import { RequestsGateway } from './requests.gateway';

const fakeSocket = (token?: string) =>
  ({
    handshake: { auth: { token } },
    join: jest.fn(async () => undefined),
    disconnect: jest.fn(),
  }) as unknown as Socket;

const jwtAccepting = (payload: { sub: string; role: Role }) =>
  ({
    verifyAsync: jest.fn().mockResolvedValue(payload),
  }) as unknown as JwtService;

const jwtRejecting = () =>
  ({
    verifyAsync: jest.fn().mockRejectedValue(new Error('invalid')),
  }) as unknown as JwtService;

describe('RequestsGateway', () => {
  it('disconnects clients without a valid token', async () => {
    const gateway = new RequestsGateway(jwtRejecting());
    const socket = fakeSocket('garbage');
    await gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('joins a requester only into the own-user room', async () => {
    const gateway = new RequestsGateway(
      jwtAccepting({ sub: 'u1', role: Role.Requester }),
    );
    const socket = fakeSocket('valid');
    await gateway.handleConnection(socket);
    expect(socket.join).toHaveBeenCalledWith('user:u1');
    expect(socket.join).toHaveBeenCalledTimes(1);
  });

  it('joins reviewers additionally into the reviewers room', async () => {
    const gateway = new RequestsGateway(
      jwtAccepting({ sub: 'r1', role: Role.Reviewer }),
    );
    const socket = fakeSocket('valid');
    await gateway.handleConnection(socket);
    expect(socket.join).toHaveBeenCalledWith('user:r1');
    expect(socket.join).toHaveBeenCalledWith('reviewers');
  });

  it('broadcasts status changes to reviewers and the owning requester only', () => {
    const gateway = new RequestsGateway(jwtRejecting());
    const emit = jest.fn();
    const to = jest
      .fn()
      .mockReturnValue({ to: jest.fn().mockReturnValue({ emit }) });
    gateway.server = { to } as never;

    const event = new RequestStatusChangedEvent(
      'req1',
      RequestStatus.InReview,
      RequestStatus.Approved,
      'rev1',
      'owner1',
      'Bürostuhl',
    );
    gateway.onStatusChanged(event);

    expect(to).toHaveBeenCalledWith('reviewers');
    expect(emit).toHaveBeenCalledWith('request.status-changed', event);
  });
});
