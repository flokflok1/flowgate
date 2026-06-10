import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CurrentUser } from './current-user';

const TOKEN_KEY = 'flowgate.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly currentUser = computed<CurrentUser | null>(() => this.decode(this.token()));
  readonly isLoggedIn = computed(() => this.currentUser() !== null);

  login(email: string, password: string): Observable<{ accessToken: string }> {
    return this.http
      .post<{ accessToken: string }>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap(({ accessToken }) => this.setToken(accessToken)));
  }

  logout(): void {
    this.setToken(null);
  }

  rawToken(): string | null {
    return this.token();
  }

  private setToken(value: string | null): void {
    if (value === null) {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, value);
    }
    this.token.set(value);
  }

  private decode(token: string | null): CurrentUser | null {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1])) as CurrentUser;
      return payload.exp * 1000 > Date.now() ? payload : null; // expired → treat as logged out
    } catch {
      return null;
    }
  }
}
