import { DatePipe } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import {
  CATEGORY_LABELS,
  RequestStatus,
  STATUS_LABELS,
} from '../../../core/requests/request.model';
import { RequestsService } from '../../../core/requests/requests.service';

@Component({
  selector: 'app-request-list',
  imports: [DatePipe, RouterLink],
  templateUrl: './request-list.html',
  styleUrl: './request-list.scss',
})
export class RequestList implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly requestsService = inject(RequestsService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);

  constructor() {
    // live updates: any status change reloads the list
    effect(() => {
      if (this.realtime.lastEvent()) this.requestsService.reload();
    });
  }

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statuses = Object.keys(STATUS_LABELS) as RequestStatus[];

  protected readonly statusFilter = signal<RequestStatus | null>(null);
  protected readonly filtered = computed(() => {
    const filter = this.statusFilter();
    const all = this.requestsService.requests();
    return filter === null ? all : all.filter((r) => r.status === filter);
  });

  ngOnInit(): void {
    this.requestsService.reload();
  }

  protected setFilter(status: RequestStatus | null): void {
    this.statusFilter.set(status);
  }

  /** short, file-number style reference derived from the uuid (e.g. FG-3F2A) */
  protected shortId(id: string): string {
    return `FG-${id.slice(0, 4).toUpperCase()}`;
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
