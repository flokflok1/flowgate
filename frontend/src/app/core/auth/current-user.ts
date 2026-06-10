export type Role = 'requester' | 'reviewer' | 'admin';

export interface CurrentUser {
  sub: string; // user id
  email: string;
  role: Role;
  exp: number; // unix seconds
}
