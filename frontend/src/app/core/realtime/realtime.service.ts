import { Injectable, effect, inject, signal } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { AuthService } from '../auth/auth.service';
import { RequestStatus, STATUS_LABELS } from '../requests/request.model';

export interface StatusChangedEvent {
  requestId: string;
  from: RequestStatus | null;
  to: RequestStatus;
  actorId: string;
  requesterId: string;
  title: string;
}

export interface Toast {
  id: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthService);
  private socket: Socket | null = null;
  private toastSeq = 0;

  /** latest incoming event — views react via effect() */
  readonly lastEvent = signal<StatusChangedEvent | null>(null);
  readonly toasts = signal<Toast[]>([]);

  constructor() {
    // connect while logged in, disconnect on logout — driven by the auth signal
    effect(() => {
      const token = this.auth.isLoggedIn() ? this.auth.rawToken() : null;
      this.disconnect();
      if (token) this.connect(token);
    });
  }

  private connect(token: string): void {
    this.socket = io({ path: '/api/socket.io', auth: { token } });
    this.socket.on('request.status-changed', (event: StatusChangedEvent) => {
      this.lastEvent.set(event);
      this.pushToast(`„${event.title}" → ${STATUS_LABELS[event.to]}`);
    });
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private pushToast(message: string): void {
    const toast: Toast = { id: ++this.toastSeq, message };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => {
      this.toasts.update((list) => list.filter((t) => t.id !== toast.id));
    }, 5000);
  }
}
