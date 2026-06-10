import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../../shared/types/auth-user';
import { Role } from '../../users/domain/value-objects/role';
import { Request, RequestPayload } from '../domain/entities/request';
import { NotRequestOwner } from '../domain/errors';
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

  create(user: AuthUser, input: RequestInput): Promise<Request> {
    return this.requests.create({ ...input, requesterId: user.sub });
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
    request.submit(user.sub); // invariant lives in the entity
    await this.requests.save(request);
    return request;
  }
}
