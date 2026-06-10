import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthUser } from '../../shared/types/auth-user';
import { Role } from '../../users/domain/value-objects/role';
import { Request, RequestPayload } from '../domain/entities/request';
import { RequestEvent } from '../domain/entities/request-event';
import { NotRequestOwner } from '../domain/errors';
import { RequestStatusChangedEvent } from '../domain/events/request-status-changed.event';
import { REQUEST_EVENT_REPOSITORY } from '../domain/repositories/request-event.repository';
import type { RequestEventRepository } from '../domain/repositories/request-event.repository';
import { REQUEST_REPOSITORY } from '../domain/repositories/request.repository';
import type { RequestRepository } from '../domain/repositories/request.repository';

export interface RequestInput {
  title: string;
  payload: RequestPayload;
}

@Injectable()
export class ManageRequestsUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
    @Inject(REQUEST_EVENT_REPOSITORY)
    private readonly events: RequestEventRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  list(user: AuthUser): Promise<Request[]> {
    return user.role === Role.Requester
      ? this.requests.findByRequester(user.sub)
      : this.requests.findAll();
  }

  async get(user: AuthUser, id: string): Promise<Request> {
    const request = await this.requests.findById(id);
    if (!request) throw new NotFoundException();
    if (user.role === Role.Requester && request.requesterId !== user.sub) {
      throw new NotRequestOwner();
    }
    return request;
  }

  async eventsFor(user: AuthUser, id: string): Promise<RequestEvent[]> {
    await this.get(user, id); // same visibility rules as the request itself
    return this.events.listByRequest(id);
  }

  async create(user: AuthUser, input: RequestInput): Promise<Request> {
    const request = await this.requests.create({
      ...input,
      requesterId: user.sub,
    });
    await this.events.append({
      requestId: request.id,
      actorId: user.sub,
      action: 'created',
      fromStatus: null,
      toStatus: request.status,
    });
    return request;
  }

  async update(
    user: AuthUser,
    id: string,
    input: RequestInput,
  ): Promise<Request> {
    const request = await this.requests.findById(id);
    if (!request) throw new NotFoundException();
    request.updateDraft(user.sub, input.title, input.payload); // invariant lives in the entity
    await this.requests.save(request);
    return request;
  }

  async submit(user: AuthUser, id: string): Promise<Request> {
    const request = await this.requests.findById(id);
    if (!request) throw new NotFoundException();
    const change = request.submit(user.sub); // invariant lives in the entity
    await this.requests.save(request);
    await this.events.append({
      requestId: request.id,
      actorId: user.sub,
      action: 'submitted',
      fromStatus: change.from,
      toStatus: change.to,
    });
    this.eventEmitter.emit(
      RequestStatusChangedEvent.eventName,
      new RequestStatusChangedEvent(
        request.id,
        change.from,
        change.to,
        user.sub,
        request.requesterId,
        request.title,
      ),
    );
    return request;
  }
}
