import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuthUser } from '../../shared/types/auth-user';
import { Role } from '../../users/domain/value-objects/role';
import { Decision, Request, StatusChange } from '../domain/entities/request';
import type { AuditAction } from '../domain/entities/request-event';
import { RequestStatusChangedEvent } from '../domain/events/request-status-changed.event';
import { REQUEST_EVENT_REPOSITORY } from '../domain/repositories/request-event.repository';
import type { RequestEventRepository } from '../domain/repositories/request-event.repository';
import { REQUEST_REPOSITORY } from '../domain/repositories/request.repository';
import type { RequestRepository } from '../domain/repositories/request.repository';
import { DecisionDto } from './dto/decision.dto';

@Injectable()
export class ReviewRequestUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly requests: RequestRepository,
    @Inject(REQUEST_EVENT_REPOSITORY)
    private readonly events: RequestEventRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async startReview(user: AuthUser, id: string): Promise<Request> {
    const request = await this.load(id);
    const change = request.startReview(user.sub);
    return this.persist(request, user, 'review_started', change, null);
  }

  async decide(user: AuthUser, id: string, dto: DecisionDto): Promise<Request> {
    const request = await this.load(id);
    const change = request.decide(
      user.sub,
      dto.decision as Decision,
      user.role === Role.Admin,
    );
    return this.persist(
      request,
      user,
      dto.decision,
      change,
      dto.comment ?? null,
    );
  }

  private async load(id: string): Promise<Request> {
    const request = await this.requests.findById(id);
    if (!request) throw new NotFoundException();
    return request;
  }

  private async persist(
    request: Request,
    user: AuthUser,
    action: AuditAction,
    change: StatusChange,
    comment: string | null,
  ): Promise<Request> {
    await this.requests.save(request);
    await this.events.append({
      requestId: request.id,
      actorId: user.sub,
      action,
      fromStatus: change.from,
      toStatus: change.to,
      comment,
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
