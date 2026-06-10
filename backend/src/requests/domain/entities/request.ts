import {
  InvalidStatusTransition,
  NotAssignedReviewer,
  NotRequestOwner,
  RequestNotEditable,
} from '../errors';
import { RequestStatus } from '../value-objects/request-status';

export interface RequestPayload {
  category: 'purchase' | 'travel' | 'access' | 'other';
  description: string;
  amountEur?: number;
  neededBy?: string; // ISO date
}

export interface StatusChange {
  from: RequestStatus;
  to: RequestStatus;
}

export type Decision =
  | RequestStatus.Approved
  | RequestStatus.Rejected
  | RequestStatus.ChangesRequested;

/** which status may move where — the single source of truth of the state machine */
const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  [RequestStatus.Draft]: [RequestStatus.Submitted],
  [RequestStatus.Submitted]: [RequestStatus.InReview],
  [RequestStatus.InReview]: [
    RequestStatus.Approved,
    RequestStatus.Rejected,
    RequestStatus.ChangesRequested,
  ],
  [RequestStatus.ChangesRequested]: [RequestStatus.Submitted],
  [RequestStatus.Approved]: [],
  [RequestStatus.Rejected]: [],
};

const EDITABLE: RequestStatus[] = [
  RequestStatus.Draft,
  RequestStatus.ChangesRequested,
];

export class Request {
  constructor(
    public readonly id: string,
    public title: string,
    public payload: RequestPayload,
    public status: RequestStatus,
    public readonly requesterId: string,
    public reviewerId: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {}

  private assertOwnedBy(userId: string): void {
    if (this.requesterId !== userId) throw new NotRequestOwner();
  }

  private transitionTo(next: RequestStatus): StatusChange {
    const allowed = TRANSITIONS[this.status];
    if (!allowed.includes(next)) throw new InvalidStatusTransition();
    const from = this.status;
    this.status = next;
    return { from, to: next };
  }

  updateDraft(userId: string, title: string, payload: RequestPayload): void {
    this.assertOwnedBy(userId);
    if (!EDITABLE.includes(this.status)) throw new RequestNotEditable();
    this.title = title;
    this.payload = payload;
  }

  /** draft → submitted, and also changes_requested → submitted (resubmit) */
  submit(userId: string): StatusChange {
    this.assertOwnedBy(userId);
    return this.transitionTo(RequestStatus.Submitted);
  }

  /** submitted → in_review; whoever starts the review becomes the assigned reviewer */
  startReview(reviewerId: string): StatusChange {
    const change = this.transitionTo(RequestStatus.InReview);
    this.reviewerId = reviewerId;
    return change;
  }

  /** in_review → approved | rejected | changes_requested — assigned reviewer only */
  decide(
    reviewerId: string,
    decision: Decision,
    isAdmin = false,
  ): StatusChange {
    if (!isAdmin && this.reviewerId !== reviewerId) {
      throw new NotAssignedReviewer();
    }
    return this.transitionTo(decision);
  }
}
