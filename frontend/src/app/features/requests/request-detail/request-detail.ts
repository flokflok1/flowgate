import { DatePipe } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import {
  ACTION_LABELS,
  CATEGORY_LABELS,
  RequestEvent,
  ReviewDecision,
  STATUS_LABELS,
  WorkflowRequest,
} from '../../../core/requests/request.model';
import { RequestsService } from '../../../core/requests/requests.service';

@Component({
  selector: 'app-request-detail',
  imports: [DatePipe, RouterLink, ReactiveFormsModule],
  templateUrl: './request-detail.html',
  styleUrl: './request-detail.scss',
})
export class RequestDetail implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly requests = inject(RequestsService);
  private readonly realtime = inject(RealtimeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  constructor() {
    // live updates: refresh status + timeline when THIS request changes elsewhere
    effect(() => {
      const event = this.realtime.lastEvent();
      const current = this.request();
      if (event && current && event.requestId === current.id) {
        this.load(current.id);
      }
    });
  }

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly actionLabels = ACTION_LABELS;

  protected readonly request = signal<WorkflowRequest | null>(null);
  protected readonly events = signal<RequestEvent[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  // comment is mandatory for reject/changes — mirrored client-side
  protected readonly commentCtrl = this.fb.control('', [
    Validators.minLength(10),
    Validators.maxLength(2000),
  ]);
  protected readonly commentError = signal<string | null>(null);

  private readonly user = computed(() => this.auth.currentUser());
  private readonly isReviewerOrAdmin = computed(() => {
    const role = this.user()?.role;
    return role === 'reviewer' || role === 'admin';
  });

  /** owner can edit/submit while draft or changes_requested */
  protected readonly canEdit = computed(() => {
    const current = this.request();
    const user = this.user();
    return (
      current !== null &&
      user !== null &&
      (current.status === 'draft' || current.status === 'changes_requested') &&
      current.requesterId === user.sub
    );
  });

  protected readonly canStartReview = computed(
    () => this.request()?.status === 'submitted' && this.isReviewerOrAdmin(),
  );

  /** decision panel: assigned reviewer or any admin, while in review */
  protected readonly canDecide = computed(() => {
    const current = this.request();
    const user = this.user();
    if (!current || !user || current.status !== 'in_review') return false;
    return user.role === 'admin' || current.reviewerId === user.sub;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.load(id);
  }

  protected shortId(id: string): string {
    return `FG-${id.slice(0, 4).toUpperCase()}`;
  }

  protected submit(): void {
    const current = this.request();
    if (!current) return;
    this.run(this.requests.submit(current.id), 'Einreichen fehlgeschlagen.');
  }

  protected startReview(): void {
    const current = this.request();
    if (!current) return;
    this.run(
      this.requests.startReview(current.id),
      'Prüfung konnte nicht gestartet werden.',
    );
  }

  protected decide(decision: ReviewDecision): void {
    const current = this.request();
    if (!current) return;
    const comment = this.commentCtrl.value.trim();
    if (decision !== 'approved' && comment.length < 10) {
      this.commentError.set(
        'Bitte begründe die Entscheidung (mindestens 10 Zeichen).',
      );
      return;
    }
    this.commentError.set(null);
    this.run(
      this.requests.decide(current.id, decision, comment || undefined),
      'Entscheidung fehlgeschlagen.',
    );
  }

  private run(
    action$: ReturnType<RequestsService['submit']>,
    errorMessage: string,
  ): void {
    this.busy.set(true);
    action$.subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.commentCtrl.reset();
        this.load(updated.id);
      },
      error: () => {
        this.busy.set(false);
        this.error.set(errorMessage);
      },
    });
  }

  private load(id: string): void {
    this.requests.get(id).subscribe({
      next: (request) => this.request.set(request),
      error: () => this.error.set('Antrag nicht gefunden oder kein Zugriff.'),
    });
    this.requests.events(id).subscribe({
      next: (events) => this.events.set(events),
      error: () => undefined, // timeline is non-critical — request view still works
    });
  }
}
