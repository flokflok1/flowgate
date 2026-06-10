import { DatePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import {
  CATEGORY_LABELS,
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
  private readonly router = inject(Router);

  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;

  ngOnInit(): void {
    this.requestsService.reload();
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
