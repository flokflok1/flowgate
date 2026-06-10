import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CATEGORY_LABELS,
  STATUS_LABELS,
  WorkflowRequest,
} from '../../../core/requests/request.model';
import { RequestsService } from '../../../core/requests/requests.service';

@Component({
  selector: 'app-request-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './request-detail.html',
  styleUrl: './request-detail.scss',
})
export class RequestDetail implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly requests = inject(RequestsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;

  protected readonly request = signal<WorkflowRequest | null>(null);
  protected readonly error = signal<string | null>(null);

  /** owner can edit/submit while the request is still a draft */
  protected readonly canEdit = computed(() => {
    const current = this.request();
    const user = this.auth.currentUser();
    return (
      current !== null &&
      user !== null &&
      current.status === 'draft' &&
      current.requesterId === user.sub
    );
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.requests.get(id).subscribe({
      next: (request) => this.request.set(request),
      error: () => this.error.set('Antrag nicht gefunden oder kein Zugriff.'),
    });
  }

  protected shortId(id: string): string {
    return `FG-${id.slice(0, 4).toUpperCase()}`;
  }

  protected submit(): void {
    const current = this.request();
    if (!current) return;
    this.requests.submit(current.id).subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: () => this.error.set('Einreichen fehlgeschlagen.'),
    });
  }
}
